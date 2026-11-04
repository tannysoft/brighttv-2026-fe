// Sitemaps from the Payload CMS (CMS_SOURCE=payload). Same file names as the
// Yoast ones (sitemap_index.xml, post-sitemapN.xml…), 1,000 URLs per file.
import { SITE_ORIGIN } from "./env";
import { sitemapAuthors, sitemapCategories, sitemapPages, sitemapPosts, sitemapTags, type SitemapRow } from "./payload";

const PER_FILE = 1000;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const urlset = (rows: SitemapRow[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows
    .map((r) => `  <url>\n    <loc>${esc(r.loc)}</loc>\n    <lastmod>${r.lastmod}</lastmod>\n  </url>`)
    .join("\n")}\n</urlset>`;
const fileName = (base: string, n: number) => (n === 1 ? `${base}.xml` : `${base}${n}.xml`);

/** XML for a sitemap segment ("index", "post-sitemap3"…), or null when unknown / out of range. */
export async function payloadSitemap(segment: string): Promise<string | null> {
  if (segment === "index") {
    const [posts, tags] = await Promise.all([sitemapPosts(1, 1), sitemapTags(1, 1)]);
    const now = new Date().toISOString();
    const files: [string, string][] = [];
    for (let i = 1; i <= Math.max(1, Math.ceil(posts.total / PER_FILE)); i++)
      files.push([fileName("post-sitemap", i), i === 1 ? (posts.rows[0]?.lastmod ?? now) : now]);
    files.push(["page-sitemap.xml", now], ["category-sitemap.xml", now]);
    for (let i = 1; i <= Math.max(1, Math.ceil(tags.total / PER_FILE)); i++) files.push([fileName("post_tag-sitemap", i), now]);
    files.push(["author-sitemap.xml", now]);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files
      .map(([f, m]) => `  <sitemap>\n    <loc>${SITE_ORIGIN}/${f}</loc>\n    <lastmod>${m}</lastmod>\n  </sitemap>`)
      .join("\n")}\n</sitemapindex>`;
  }
  const numbered = segment.match(/^(post-sitemap|post_tag-sitemap)(\d+)?$/);
  if (numbered) {
    const n = numbered[2] ? Number(numbered[2]) : 1;
    // Pages of 1,000 read as 10 CMS pages of 100 (keeps each query small).
    const parts = await Promise.all(
      Array.from({ length: PER_FILE / 100 }, (_, i) =>
        (numbered[1] === "post-sitemap" ? sitemapPosts : sitemapTags)((n - 1) * (PER_FILE / 100) + i + 1, 100),
      ),
    );
    const rows = parts.flatMap((p) => p.rows);
    if (!rows.length && n > 1) return null;
    return urlset(rows);
  }
  if (segment === "category-sitemap") return urlset(await sitemapCategories());
  if (segment === "page-sitemap") return urlset([{ loc: SITE_ORIGIN, lastmod: new Date().toISOString() }, ...(await sitemapPages())]);
  if (segment === "author-sitemap") return urlset(await sitemapAuthors());
  return null;
}
