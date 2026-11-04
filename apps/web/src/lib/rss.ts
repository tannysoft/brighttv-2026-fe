// RSS 2.0 feeds (/feed, /feed/{category path}, /tag/{slug}/feed) — the URLs
// WordPress served, still used by aggregators and LINE Today-style readers.
import { SITE_ORIGIN } from "./env";
import type { WPPost } from "./wp";
import { getAuthorName, getFeaturedImage, getPostPath, getPrimaryCategory, stripHtml } from "./utils";

export const FEED_SIZE = 20;
export const FEED_TTL = 600; // 10 minutes

function xml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Control characters are not allowed in XML 1.0.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/** WordPress local/GMT timestamp → RFC 822 date. */
function rfc822(post: WPPost): string {
  const d = post.date_gmt ? new Date(`${post.date_gmt.replace(/Z$/, "")}Z`) : new Date(`${post.date}+07:00`);
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

/** HTML as a CDATA section ("]]>" split across two sections; no XML-illegal characters). */
function cdata(html: string): string {
  const clean = html.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "");
  return `<![CDATA[${clean.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export function rssResponse(opts: { title: string; path: string; description: string; posts: WPPost[] }): Response {
  const feedUrl = `${SITE_ORIGIN}${opts.path === "/" ? "" : opts.path}/feed`;
  const items = opts.posts.map((p) => {
    const url = `${SITE_ORIGIN}${getPostPath(p)}`;
    const cat = getPrimaryCategory(p);
    const img = getFeaturedImage(p, "large");
    return [
      "    <item>",
      `      <title>${xml(stripHtml(p.title.rendered))}</title>`,
      `      <link>${xml(url)}</link>`,
      `      <guid isPermaLink="false">${xml(`${SITE_ORIGIN}/?p=${p.id}`)}</guid>`,
      `      <pubDate>${rfc822(p)}</pubDate>`,
      `      <dc:creator>${xml(getAuthorName(p))}</dc:creator>`,
      cat ? `      <category>${xml(stripHtml(cat.name))}</category>` : "",
      `      <description>${xml(stripHtml(p.excerpt?.rendered))}</description>`,
      p.content?.rendered ? `      <content:encoded>${cdata(p.content.rendered)}</content:encoded>` : "",
      img?.url ? `      <media:content url="${xml(img.url)}" medium="image" />` : "",
      "    </item>",
    ]
      .filter(Boolean)
      .join("\n");
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${xml(opts.title)}</title>
    <atom:link href="${xml(feedUrl)}" rel="self" type="application/rss+xml" />
    <link>${xml(`${SITE_ORIGIN}${opts.path}`)}</link>
    <description>${xml(opts.description)}</description>
    <language>th</language>
    <lastBuildDate>${opts.posts[0] ? rfc822(opts.posts[0]) : new Date().toUTCString()}</lastBuildDate>
    <ttl>10</ttl>
${items.join("\n")}
  </channel>
</rss>
`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=UTF-8",
      "Cache-Control": `public, s-maxage=${FEED_TTL}, stale-while-revalidate=${FEED_TTL * 6}`,
    },
  });
}
