import { CMS_SOURCE, SITE_ORIGIN, WP_API_ORIGIN } from "@/lib/env";
import { payloadSitemap } from "@/lib/sitemap-payload";

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

    if (CMS_SOURCE === "payload") {
      const out = await payloadSitemap(segment);
      if (!out) return new Response("Not Found", { status: 404 });
      xml = out;
    } else if (segment === "index") {
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
  // Cheap: the number of sub-sitemaps comes from X-WP-Total (one cached
  // per_page=1 request per type) instead of walking every page. Only the
  // first post sitemap (newest stories) gets a real <lastmod>; the older
  // ones' content rarely changes, and <lastmod> is optional.
  const [posts, tags, newest] = await Promise.all([
    getTotal(`${WP_API_ORIGIN}/wp-json/contents/v1/posts`),
    getTotal(`${WP_API_ORIGIN}/wp-json/wp/v2/tags`),
    json<Array<{ modified_gmt?: string }>>(`${WP_API_ORIGIN}/wp-json/contents/v1/posts?per_page=1&_fields=modified_gmt`),
  ]);
  if (!posts) throw new Error("WordPress post total unavailable");
  const postPages = Math.ceil(posts / PER_PAGE);
  const tagPages = Math.ceil(tags / PER_PAGE);
  const now = new Date().toISOString();
  const latest = newest[0]?.modified_gmt ? `${newest[0].modified_gmt}+00:00` : now;

  const e: string[] = [];
  for (let i = 1; i <= postPages; i++) {
    const file = i === 1 ? "post-sitemap.xml" : `post-sitemap${i}.xml`;
    e.push(entry(file, i === 1 ? latest : undefined));
  }
  e.push(entry("category-sitemap.xml", latest));

  for (let i = 1; i <= tagPages; i++) {
    const file = i === 1 ? "post_tag-sitemap.xml" : `post_tag-sitemap${i}.xml`;
    e.push(entry(file, i === 1 ? latest : undefined));
  }

  e.push(entry("page-sitemap.xml"));
  e.push(entry("author-sitemap.xml", latest));
  return wrap("sitemapindex", e.join("\n"));
}

function entry(file: string, lastmod?: string) {
  const mod = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <sitemap>\n    <loc>${SITE_ORIGIN}/${file}</loc>${mod}\n  </sitemap>`;
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

/** X-WP-Total of a collection: one cached per_page=1 request. */
async function getTotal(url: string) {
  try {
    const r = await fetch(`${url}?per_page=1&_fields=id`, { next: { revalidate: CACHE_TTL }, headers: WP_HEADERS });
    const n = parseInt(r.headers.get("x-wp-total") || "0", 10);
    return Number.isFinite(n) ? n : 0;
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
