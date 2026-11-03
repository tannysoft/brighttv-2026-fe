import { SITE_ORIGIN, WP_API_ORIGIN } from "@/lib/env";

// Yoast-compatible dynamic sitemap built from contents/v1 + wp/v2 APIs.
//
// Routed via next.config.ts beforeFiles rewrites:
//   /sitemap.xml            → /api/sitemap/index
//   /post-sitemap.xml       → /api/sitemap/post-sitemap
//   /post-sitemap2.xml      → /api/sitemap/post-sitemap2
//   /category-sitemap.xml   → /api/sitemap/category-sitemap
//   /post_tag-sitemap.xml   → /api/sitemap/post_tag-sitemap
//   /post_tag-sitemap2.xml  → /api/sitemap/post_tag-sitemap2
//   /author-sitemap.xml     → /api/sitemap/author-sitemap

const WP_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
} as const;

const PER_PAGE = 100;
const CACHE_TTL = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const segment = path.join("/"); // e.g. "index", "post-sitemap", "post-sitemap2"

  try {
    let xml: string;

    if (segment === "index") {
      xml = await buildIndex();
    } else if (segment.startsWith("post-sitemap")) {
      const m = segment.match(/post-sitemap(\d+)?$/);
      xml = await buildPostSitemap(m?.[1] ? parseInt(m[1], 10) : 1);
    } else if (segment === "category-sitemap") {
      xml = await buildCategorySitemap();
    } else if (segment.startsWith("post_tag-sitemap")) {
      const m = segment.match(/post_tag-sitemap(\d+)?$/);
      xml = await buildTagSitemap(m?.[1] ? parseInt(m[1], 10) : 1);
    } else if (segment === "page-sitemap") {
      xml = await buildPageSitemap();
    } else if (segment === "author-sitemap") {
      xml = await buildAuthorSitemap();
    } else {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=UTF-8",
        "Cache-Control": `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=${CACHE_TTL * 2}`,
      },
    });
  } catch {
    return new Response('<?xml version="1.0"?><error>Sitemap unavailable</error>', {
      status: 502,
      headers: { "Content-Type": "application/xml" },
    });
  }
}

// ===== Sitemap Index =====

async function buildIndex(): Promise<string> {
  // Fetch totals + the LAST post of each page's batch (1 post per page)
  // to get the real lastmod date. Posts are sorted date desc, so page 1's
  // LAST item (post #100) is the oldest in that batch — but we want the
  // FIRST item (newest) as lastmod. Use per_page=1 to get just that.
  //
  // For 1712 pages we batch 50 parallel HEAD-like calls at a time.
  const [postTotal, tagTotal] = await Promise.all([
    getTotal(`${WP_API_ORIGIN}/wp-json/contents/v1/posts`),
    getTotal(`${WP_API_ORIGIN}/wp-json/wp/v2/tags`),
  ]);
  const postPages = Math.ceil(postTotal / PER_PAGE);
  const tagPages = Math.ceil(tagTotal / PER_PAGE);
  const now = new Date().toISOString();

  // Fetch lastmod for each post-sitemap page: get the first (newest) post
  // of each 100-post batch via per_page=1&page=((N-1)*100+1).
  // Batch 50 at a time to stay fast without overwhelming WP.
  const lastmods: Record<number, string> = {};
  const BATCH = 50;
  for (let start = 1; start <= postPages; start += BATCH) {
    const end = Math.min(start + BATCH - 1, postPages);
    await Promise.all(
      Array.from({ length: end - start + 1 }, (_, i) => {
        const page = start + i;
        const apiPage = (page - 1) * PER_PAGE + 1;
        return json<Array<{ modified_gmt?: string }>>(
          `${WP_API_ORIGIN}/wp-json/contents/v1/posts?per_page=1&page=${apiPage}`,
        ).then((posts) => {
          if (posts[0]?.modified_gmt) lastmods[page] = `${posts[0].modified_gmt}+00:00`;
        });
      }),
    );
  }

  const e: string[] = [];
  for (let i = 1; i <= postPages; i++) {
    const file = i === 1 ? "post-sitemap.xml" : `post-sitemap${i}.xml`;
    e.push(entry(file, lastmods[i] || now));
  }
  e.push(entry("category-sitemap.xml", now));

  for (let i = 1; i <= tagPages; i++) {
    const file = i === 1 ? "post_tag-sitemap.xml" : `post_tag-sitemap${i}.xml`;
    e.push(entry(file, now));
  }

  e.push(entry("page-sitemap.xml", now));
  e.push(entry("author-sitemap.xml", now));
  return wrap("sitemapindex", e.join("\n"));
}

function entry(file: string, lastmod: string) {
  return `  <sitemap>\n    <loc>${SITE_ORIGIN}/${file}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`;
}

// ===== Post Sitemap =====

type Post = {
  pathname?: string; slug: string; link: string;
  modified_gmt?: string;
  featured_image?: { sizes?: Record<string, { src: string }> };
};

async function buildPostSitemap(page: number): Promise<string> {
  const posts = await json<Post[]>(
    `${WP_API_ORIGIN}/wp-json/contents/v1/posts?per_page=${PER_PAGE}&page=${page}`,
  );
  const e = posts.map((p) => {
    const loc = esc(resolveUrl(p));
    const mod = p.modified_gmt ? `\n    <lastmod>${p.modified_gmt}+00:00</lastmod>` : "";
    const img = p.featured_image?.sizes?.large?.src || p.featured_image?.sizes?.full?.src;
    const imgTag = img ? `\n    <image:image>\n      <image:loc>${esc(img)}</image:loc>\n    </image:image>` : "";
    return `  <url>\n    <loc>${loc}</loc>${mod}${imgTag}\n  </url>`;
  });
  return wrap("urlset", e.join("\n"), true);
}

function resolveUrl(p: Post): string {
  if (p.pathname?.startsWith("/")) return `${SITE_ORIGIN}${p.pathname.replace(/\/$/, "")}`;
  try { return `${SITE_ORIGIN}${new URL(p.link).pathname.replace(/\/$/, "")}`; } catch {}
  return `${SITE_ORIGIN}/${p.slug}`;
}

// ===== Category Sitemap =====

async function buildCategorySitemap(): Promise<string> {
  const cats = await fetchAll<{ slug: string }>(`${WP_API_ORIGIN}/wp-json/wp/v2/categories`);
  const e = cats.map((c) => `  <url>\n    <loc>${esc(`${SITE_ORIGIN}/category/${c.slug}`)}</loc>\n  </url>`);
  return wrap("urlset", e.join("\n"));
}

// ===== Page Sitemap =====

async function buildPageSitemap(): Promise<string> {
  const pages = await fetchAll<{
    slug: string; link: string; modified_gmt?: string;
    featured_image?: { sizes?: Record<string, { src: string }> };
  }>(`${WP_API_ORIGIN}/wp-json/wp/v2/pages`);

  const e = [`  <url>\n    <loc>${esc(SITE_ORIGIN)}</loc>\n  </url>`];
  for (const p of pages) {
    if (p.slug === "home") continue;
    let path = "";
    try { path = new URL(p.link).pathname.replace(/\/$/, ""); } catch { path = `/${p.slug}`; }
    const mod = p.modified_gmt ? `\n    <lastmod>${p.modified_gmt}+00:00</lastmod>` : "";
    const img = p.featured_image?.sizes?.large?.src;
    const imgTag = img ? `\n    <image:image>\n      <image:loc>${esc(img)}</image:loc>\n    </image:image>` : "";
    e.push(`  <url>\n    <loc>${esc(`${SITE_ORIGIN}${path}`)}</loc>${mod}${imgTag}\n  </url>`);
  }
  return wrap("urlset", e.join("\n"), true);
}

// ===== Tag Sitemap =====

async function buildTagSitemap(page: number): Promise<string> {
  let tags: { id: number; slug: string }[] = [];
  try {
    const r = await fetch(
      `${WP_API_ORIGIN}/wp-json/wp/v2/tags?per_page=${PER_PAGE}&page=${page}&orderby=count&order=desc`,
      { headers: WP_HEADERS },
    );
    if (r.ok) tags = await r.json();
  } catch { /* skip */ }

  // Fetch lastmod per tag from its latest post
  const lastmods: Record<number, string> = {};
  const BATCH = 20;
  for (let start = 0; start < tags.length; start += BATCH) {
    const batch = tags.slice(start, start + BATCH);
    await Promise.all(
      batch.map(async (t) => {
        try {
          const r = await fetch(
            `${WP_API_ORIGIN}/wp-json/contents/v1/posts?tags=${t.id}&per_page=1`,
            { headers: WP_HEADERS },
          );
          if (r.ok) {
            const posts = (await r.json()) as Array<{ modified_gmt?: string }>;
            if (posts[0]?.modified_gmt) {
              lastmods[t.id] = `${posts[0].modified_gmt}+00:00`;
            }
          }
        } catch { /* skip */ }
      }),
    );
  }

  const e = tags.map((t) => {
    const loc = esc(`${SITE_ORIGIN}/tag/${t.slug}`);
    const mod = lastmods[t.id] ? `\n    <lastmod>${lastmods[t.id]}</lastmod>` : "";
    return `  <url>\n    <loc>${loc}</loc>${mod}\n  </url>`;
  });
  return wrap("urlset", e.join("\n"));
}

// ===== Author Sitemap =====

async function buildAuthorSitemap(): Promise<string> {
  const users = await fetchAll<{ slug: string }>(`${WP_API_ORIGIN}/wp-json/wp/v2/users`);
  const e = users.map((u) => `  <url>\n    <loc>${esc(`${SITE_ORIGIN}/author/${u.slug}`)}</loc>\n  </url>`);
  return wrap("urlset", e.join("\n"));
}

// ===== Helpers =====

function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function wrap(root: string, body: string, img = false) {
  if (root === "sitemapindex")
    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
  const ns = img ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${ns}>\n${body}\n</urlset>`;
}

async function getTotal(url: string) {
  try {
    const r = await fetch(`${url}?per_page=1`, { method: "HEAD", headers: WP_HEADERS });
    return parseInt(r.headers.get("x-wp-total") || "0", 10);
  } catch { return 0; }
}

async function json<T>(url: string): Promise<T> {
  try {
    const r = await fetch(url, { next: { revalidate: CACHE_TTL }, headers: WP_HEADERS });
    return r.ok ? ((await r.json()) as T) : ([] as unknown as T);
  } catch { return [] as unknown as T; }
}

async function fetchAll<T>(base: string): Promise<T[]> {
  const all: T[] = [];
  for (let p = 1; p <= 50; p++) {
    const items = await json<T[]>(`${base}?per_page=${PER_PAGE}&page=${p}`);
    if (!items.length) break;
    all.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return all;
}
