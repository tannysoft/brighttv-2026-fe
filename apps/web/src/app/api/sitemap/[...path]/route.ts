import { CMS_SOURCE, SITE_ORIGIN, WP_API_ORIGIN } from "@/lib/env";
import { categoryPath } from "@/lib/categories";
import { payloadSitemap } from "@/lib/sitemap-payload";
import { getPosts } from "@/lib/wp";
import { getDrawDates } from "@/lib/lotto";
import { drawSlug } from "@/lib/lotto-check";
import { getPostPath, stripHtml } from "@/lib/utils";

// Yoast-compatible dynamic sitemaps (same file names as the WordPress site).
//
// Routed via next.config.ts beforeFiles rewrites:
//   /sitemap.xml, /sitemap_index.xml → /api/sitemap/index
//   /post-sitemap.xml, /post-sitemapN.xml → /api/sitemap/post-sitemap[N]   (1,000 per file, oldest first)
//   /post_tag-sitemap.xml, …N.xml     → /api/sitemap/post_tag-sitemap[N] (1,000 per file, non-empty tags)
//   /category-sitemap.xml, /page-sitemap.xml, /author-sitemap.xml
//   /news-sitemap.xml                 → Google News: stories of the last 48 hours
//   /lotto-sitemap.xml                → /lotto and every draw page
// A sub-sitemap number past the last file is a 404.

const WP_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
} as const;

const WP_PAGE = 100; // WordPress REST max per_page
const PER_FILE = 1000; // URLs per sub-sitemap, like Yoast
const CACHE_TTL = 3600;
const STABLE_TTL = 86400; // older post/tag files barely change (oldest-first order)
const NEWS_TTL = 300;
const NEWS_WINDOW_MS = 48 * 3600_000;
const NEWS_MAX = 1000;

class NotFound extends Error {}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const segment = path.join("/"); // e.g. "index", "post-sitemap", "post-sitemap2"
  let ttl = CACHE_TTL;

  try {
    let xml: string;

    if (segment === "news-sitemap") {
      xml = await buildNewsSitemap();
      ttl = NEWS_TTL;
    } else if (segment === "lotto-sitemap") {
      xml = await buildLottoSitemap();
    } else if (CMS_SOURCE === "payload") {
      const out = await payloadSitemap(segment);
      if (!out) throw new NotFound();
      // The CMS index doesn't know the source-independent sitemaps.
      xml = segment === "index" ? out.replace("</sitemapindex>", `${extraIndexEntries(await lottoLastmod())}\n</sitemapindex>`) : out;
    } else if (segment === "index") {
      xml = await buildIndex();
    } else if (/^post-sitemap(\d+)?$/.test(segment)) {
      xml = await buildPostSitemap(fileNumber(segment));
    } else if (segment === "category-sitemap") {
      xml = await buildCategorySitemap();
    } else if (/^post_tag-sitemap(\d+)?$/.test(segment)) {
      xml = await buildTagSitemap(fileNumber(segment));
    } else if (segment === "page-sitemap") {
      xml = await buildPageSitemap();
    } else if (segment === "author-sitemap") {
      xml = await buildAuthorSitemap();
    } else {
      throw new NotFound();
    }

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=UTF-8",
        "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
      },
    });
  } catch (err) {
    if (err instanceof NotFound) return new Response("Not Found", { status: 404 });
    // eslint-disable-next-line no-console
    console.error(`[sitemap] ${segment}: ${err instanceof Error ? err.message : err}`);
    return new Response('<?xml version="1.0"?><error>Sitemap unavailable</error>', {
      status: 502,
      headers: { "Content-Type": "application/xml", "Cache-Control": "no-store" },
    });
  }
}

/** "post-sitemap" → 1, "post-sitemap7" → 7; "post-sitemap1" / "post-sitemap0" → 404 (Yoast has no such file). */
function fileNumber(segment: string): number {
  const m = segment.match(/(\d+)$/);
  if (!m) return 1;
  const n = Number(m[1]);
  if (n < 2 || String(n) !== m[1]) throw new NotFound();
  return n;
}

const fileName = (base: string, n: number) => (n === 1 ? `${base}.xml` : `${base}${n}.xml`);

/** WordPress GMT time without a zone → W3C datetime. */
const gmt = (s?: string) => (s ? `${s.replace(/Z$/, "")}+00:00` : undefined);

// ===== Sitemap Index =====

async function buildIndex(): Promise<string> {
  // Cheap: the number of sub-sitemaps comes from X-WP-Total (one cached
  // per_page=1 request per type) instead of walking every page.
  const [posts, tags, newest, lotto] = await Promise.all([
    getTotal(`${WP_API_ORIGIN}/wp-json/contents/v1/posts?per_page=1&_fields=id`),
    getTotal(`${WP_API_ORIGIN}/wp-json/wp/v2/tags?hide_empty=true&per_page=1&_fields=id`),
    json<Array<{ modified_gmt?: string }>>(`${WP_API_ORIGIN}/wp-json/contents/v1/posts?per_page=1&_fields=modified_gmt`, CACHE_TTL),
    lottoLastmod(),
  ]);
  if (!posts) throw new Error("WordPress post total unavailable");
  const postFiles = Math.ceil(posts / PER_FILE);
  const tagFiles = Math.ceil(tags / PER_FILE);
  // Post files are oldest first, so only the last one gets new stories. Older
  // files' lastmod (an edit to an old story) would cost a full read: omitted.
  const latest = gmt(newest[0]?.modified_gmt);

  const e: string[] = [];
  for (let i = 1; i <= postFiles; i++) e.push(entry(fileName("post-sitemap", i), i === postFiles ? latest : undefined));
  e.push(entry("page-sitemap.xml"));
  e.push(entry("category-sitemap.xml", latest));
  for (let i = 1; i <= tagFiles; i++) e.push(entry(fileName("post_tag-sitemap", i)));
  e.push(entry("author-sitemap.xml", latest));
  return wrapIndex(`${e.join("\n")}\n${extraIndexEntries(lotto, latest)}`);
}

/** Index entries that don't depend on the CMS source. */
function extraIndexEntries(lottoMod?: string, newsMod?: string) {
  return [entry("lotto-sitemap.xml", lottoMod), entry("news-sitemap.xml", newsMod)].join("\n");
}

function entry(file: string, lastmod?: string) {
  const mod = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <sitemap>\n    <loc>${SITE_ORIGIN}/${file}</loc>${mod}\n  </sitemap>`;
}

// ===== Post Sitemap =====

async function buildPostSitemap(n: number): Promise<string> {
  const total = await getTotal(`${WP_API_ORIGIN}/wp-json/contents/v1/posts?per_page=1&_fields=id`);
  if (!total) throw new Error("WordPress post total unavailable");
  const files = Math.ceil(total / PER_FILE);
  if (n > files) throw new NotFound();
  // Oldest first, so a file's URLs don't shift as stories are published. Ten
  // WordPress pages of 100 (link + modified only: a full post object is ~20 KB).
  const ttl = n < files ? STABLE_TTL : CACHE_TTL;
  const pages = await Promise.all(
    Array.from({ length: PER_FILE / WP_PAGE }, (_, i) =>
      json<Array<{ link?: string; modified_gmt?: string }>>(
        `${WP_API_ORIGIN}/wp-json/contents/v1/posts?order=asc&per_page=${WP_PAGE}&page=${(n - 1) * (PER_FILE / WP_PAGE) + i + 1}&_fields=link,modified_gmt`,
        ttl,
        true,
      ),
    ),
  );
  const posts = pages.flat();
  if (!posts.length) throw new NotFound();
  const e = posts.flatMap((p) => {
    const path = pathOf(p.link);
    return path ? [url(`${SITE_ORIGIN}${path}`, gmt(p.modified_gmt))] : [];
  });
  return wrap(e.join("\n"));
}

function pathOf(link?: string): string | null {
  if (!link) return null;
  try {
    return new URL(link).pathname.replace(/\/$/, "") || null;
  } catch {
    return null;
  }
}

// ===== Category Sitemap =====

async function buildCategorySitemap(): Promise<string> {
  // Empty categories would 404 (the listing needs stories).
  const cats = await fetchAll<{ slug: string }>(`${WP_API_ORIGIN}/wp-json/wp/v2/categories?hide_empty=true&_fields=slug`);
  return wrap(cats.map((c) => url(`${SITE_ORIGIN}${categoryPath(c.slug)}`)).join("\n"));
}

// ===== Page Sitemap =====

async function buildPageSitemap(): Promise<string> {
  const pages = await fetchAll<{ slug: string; link: string; modified_gmt?: string }>(
    `${WP_API_ORIGIN}/wp-json/wp/v2/pages?_fields=slug,link,modified_gmt`,
  );
  const e = [url(SITE_ORIGIN)];
  for (const p of pages) {
    if (p.slug === "home") continue;
    e.push(url(`${SITE_ORIGIN}${pathOf(p.link) ?? `/${p.slug}`}`, gmt(p.modified_gmt)));
  }
  return wrap(e.join("\n"));
}

// ===== Tag Sitemap =====

async function buildTagSitemap(n: number): Promise<string> {
  // Only tags with stories (an empty tag page is a 404). No per-tag lastmod:
  // it would cost one request per tag.
  const total = await getTotal(`${WP_API_ORIGIN}/wp-json/wp/v2/tags?hide_empty=true&per_page=1&_fields=id`);
  if (!total) throw new Error("WordPress tag total unavailable");
  const files = Math.ceil(total / PER_FILE);
  if (n > files) throw new NotFound();
  const ttl = n < files ? STABLE_TTL : CACHE_TTL;
  const pages = await Promise.all(
    Array.from({ length: PER_FILE / WP_PAGE }, (_, i) =>
      json<Array<{ slug: string }>>(
        `${WP_API_ORIGIN}/wp-json/wp/v2/tags?hide_empty=true&orderby=id&order=asc&per_page=${WP_PAGE}&page=${(n - 1) * (PER_FILE / WP_PAGE) + i + 1}&_fields=slug`,
        ttl,
        true,
      ),
    ),
  );
  const tags = pages.flat();
  if (!tags.length) throw new NotFound();
  return wrap(tags.map((t) => url(`${SITE_ORIGIN}/tag/${t.slug}`)).join("\n"));
}

// ===== Author Sitemap =====

async function buildAuthorSitemap(): Promise<string> {
  // wp/v2/users lists only users with published stories.
  const users = await fetchAll<{ slug: string }>(`${WP_API_ORIGIN}/wp-json/wp/v2/users?_fields=slug`);
  return wrap(users.map((u) => url(`${SITE_ORIGIN}/author/${u.slug}`)).join("\n"));
}

// ===== Google News Sitemap =====

async function buildNewsSitemap(): Promise<string> {
  // Newest first, until a story is older than 48 hours (getPosts: either CMS).
  const since = Date.now() - NEWS_WINDOW_MS;
  const items: string[] = [];
  for (let page = 1; items.length < NEWS_MAX && page <= NEWS_MAX / WP_PAGE; page++) {
    const posts = await getPosts({ perPage: WP_PAGE, page });
    let done = posts.length < WP_PAGE;
    for (const p of posts) {
      const published = Date.parse(p.date_gmt ? `${p.date_gmt.replace(/Z$/, "")}Z` : `${p.date}+07:00`);
      if (!Number.isFinite(published) || published < since) {
        done = true;
        break;
      }
      if (items.length >= NEWS_MAX) break;
      items.push(
        [
          "  <url>",
          `    <loc>${esc(`${SITE_ORIGIN}${getPostPath(p)}`)}</loc>`,
          "    <news:news>",
          "      <news:publication>",
          "        <news:name>BRIGHT TV</news:name>",
          "        <news:language>th</news:language>",
          "      </news:publication>",
          `      <news:publication_date>${new Date(published).toISOString().replace(/\.\d{3}Z$/, "Z")}</news:publication_date>`,
          `      <news:title>${esc(stripHtml(p.title?.rendered))}</news:title>`,
          "    </news:news>",
          "  </url>",
        ].join("\n"),
      );
    }
    if (done) break;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${items.join("\n")}\n</urlset>`;
}

// ===== Lottery Sitemap =====

async function lottoLastmod(): Promise<string | undefined> {
  return (await getDrawDates())[0];
}

async function buildLottoSitemap(): Promise<string> {
  const dates = await getDrawDates(); // newest first, YYYY-MM-DD
  const e = [url(`${SITE_ORIGIN}/lotto`, dates[0])];
  for (const d of dates) e.push(url(`${SITE_ORIGIN}/lotto/${drawSlug(d)}`, d));
  return wrap(e.join("\n"));
}

// ===== Helpers =====

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

function url(loc: string, lastmod?: string) {
  const mod = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>\n    <loc>${esc(loc)}</loc>${mod}\n  </url>`;
}

function wrap(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

function wrapIndex(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}

/** X-WP-Total of a collection URL (with per_page=1): one cached request. */
async function getTotal(u: string) {
  const r = await fetch(u, { next: { revalidate: CACHE_TTL }, headers: WP_HEADERS });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  const n = parseInt(r.headers.get("x-wp-total") || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * JSON of a WordPress URL. `strict`: a failed request throws (→ 502, not cached)
 * instead of reading as an empty list, so a hiccup never publishes a short file.
 * A page past the end (WordPress: 400 rest_post_invalid_page_number) is empty.
 */
async function json<T>(u: string, ttl = CACHE_TTL, strict = false): Promise<T> {
  try {
    const r = await fetch(u, { next: { revalidate: ttl }, headers: WP_HEADERS });
    if (r.status === 400) return [] as unknown as T;
    if (!r.ok) throw new Error(`${r.status} ${u}`);
    return (await r.json()) as T;
  } catch (err) {
    if (strict) throw err;
    return [] as unknown as T;
  }
}

async function fetchAll<T>(base: string): Promise<T[]> {
  const all: T[] = [];
  for (let p = 1; p <= 50; p++) {
    const items = await json<T[]>(`${base}&per_page=${WP_PAGE}&page=${p}`, CACHE_TTL, true);
    if (!items.length) break;
    all.push(...items);
    if (items.length < WP_PAGE) break;
  }
  return all;
}
