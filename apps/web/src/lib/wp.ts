// Content fetchers for brighttv.co.th: the WordPress REST API, or the new
// Payload CMS when CMS_SOURCE=payload (./payload.ts returns the same shapes).
// This file holds ONLY type definitions and network fetchers. All pure
// conversion/formatting helpers live in `@/lib/utils`.
import { getLatestDraw } from "./lotto";
import { thaiDate } from "./lotto-check";
import { CMS_SOURCE, SITE_ORIGIN, WP_API_ORIGIN } from "./env";
import * as cms from "./payload";
import { topViewedIds } from "./views";
import { unstable_cache } from "next/cache";
import { decodeEntities } from "./utils/text";

const usePayload = CMS_SOURCE === "payload";

// New "contents/v1" custom endpoint that returns posts with all embedded
// data inline (featured_image, author_info, taxonomies, etc.) so we don't
// need the costly `?_embed=1` expansion. Falls back to `/wp/v2` for
// non-post queries (categories, users, tags, search).
const CONTENTS_BASE = `${WP_API_ORIGIN}/wp-json/contents/v1`;
const WP_V2_BASE = `${WP_API_ORIGIN}/wp-json/wp/v2`;
const REVALIDATE = 300; // 5 minutes ISR

// iThemes Security on the WP side blocks requests that don't look like a
// real browser (anything with an empty or bot-shaped User-Agent). Cloudflare
// Workers' default fetch sends `undici/*` which gets flagged, so we force
// a desktop browser UA on every upstream call.
const WP_FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
} as const;

// ---------- types ----------

export type WPRendered = { rendered: string; protected?: boolean };

export type WPImageSize = {
  ID?: number;
  width: number;
  height: number;
  src: string;
};

// Featured image shape returned by both /contents/v1/posts and the sidebar
// contents/v1/sidebar endpoint. Same shape as gallery_images items.
export type WPFeaturedImage = {
  alt?: string;
  sizes?: Partial<Record<string, WPImageSize>>;
};

export type WPAuthorInfo = {
  display_name: string;
  author_link?: string;
  pathname?: string;
};

export type WPTaxonomyTerm = {
  id: number;
  name: string;
  nicename?: string;
  slug?: string;
  pathname?: string;
};

export type WPPost = {
  id: number;
  date: string;
  date_gmt?: string;
  modified: string;
  modified_gmt?: string;
  slug: string;
  link: string;
  title: WPRendered;
  excerpt: WPRendered;
  content: WPRendered;
  author: number;
  featured_media: number;
  categories: number[];
  tags: number[];
  pathname?: string;
  /** WordPress post type: "post" (contents/v1), "page" (static pages), "program". */
  type?: string;

  // Optional view count — only set by sidebarPostToWPPost().
  views?: string | number;

  // Top-level image gallery exposed by both endpoints.
  gallery_images?: Array<{
    id: number;
    alt: string;
    sizes: Partial<Record<string, WPImageSize>>;
  }>;

  // --- NEW fields from /contents/v1/posts (preferred) ---

  // Featured image with alt + sizes, replaces _embedded["wp:featuredmedia"].
  featured_image?: WPFeaturedImage;

  // Author info, replaces _embedded.author.
  author_info?: WPAuthorInfo;

  // Categories + tags with names/slugs, replaces _embedded["wp:term"].
  taxonomies?: {
    categories?: WPTaxonomyTerm[];
    tags?: WPTaxonomyTerm[];
  };

  // Primary category (same shape on old and new endpoints).
  primary_category?: Array<{
    id: number;
    name: string;
    nicename: string;
    pathname?: string;
  }>;

  // YouTube video id — `video` from contents/v1 (may be null) OR
  // `acf.youtube_id` from wp/v2 (legacy).
  video?: string | null;
  acf?: {
    youtube_id?: string | number | null;
    [key: string]: unknown;
  };

  // --- LEGACY _embedded (populated by sidebarPostToWPPost adapter) ---
  _embedded?: {
    author?: Array<{
      id: number;
      name: string;
      slug?: string;
      link?: string;
      avatar_urls?: Record<string, string>;
    }>;
    "wp:featuredmedia"?: Array<{
      id: number;
      source_url: string;
      alt_text?: string;
      media_details?: {
        width?: number;
        height?: number;
        sizes?: Record<string, { source_url: string; width: number; height: number }>;
      };
    }>;
    "wp:term"?: Array<
      Array<{ id: number; name: string; slug: string; taxonomy: string; link: string }>
    >;
  };
};

export type WPCategory = {
  id: number;
  count: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  link: string;
  acf?: {
    heading_2?: string;
    contents?: string;
    [key: string]: unknown;
  };
};

export type WPUser = {
  id: number;
  name: string;
  url: string;
  description: string;
  link: string;
  slug: string;
  avatar_urls?: Record<string, string>;
  acf?: {
    author_image?: string;
    [key: string]: unknown;
  };
};

export type WPTag = {
  id: number;
  count: number;
  name: string;
  slug: string;
  link: string;
};

export type LottoPrize = {
  id: string;
  name: string;
  reward: string;
  amount: number;
  number: string[];
};
export type LottoResult = {
  date: string;
  prizes: LottoPrize[];
  runningNumbers: LottoPrize[];
};

// ---------- Bright "contents/v1/sidebar" endpoint shapes ----------

export type SidebarCategory = {
  id: number;
  name: string;
  slug: string;
  link?: string;
  pathname?: string;
};

export type SidebarPost = {
  id: number;
  modified: string;
  title: WPRendered;
  excerpt: WPRendered;
  author: string;
  featured_image?: WPFeaturedImage;
  primary_category?: SidebarCategory;
  pathname?: string;
  views?: string | number;
};

export type SidebarResponse = {
  related: SidebarPost[];
  latest: SidebarPost[];
  mostview: SidebarPost[];
};

// ---------- Top tags ----------

export type TopTag = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

// ---------- internal ----------

const isDev = process.env.NODE_ENV === "development";

async function apiFetch<T>(url: string, ttl = REVALIDATE): Promise<T | null> {
  try {
    // Dev: no-store → always fresh data for debugging.
    // Prod: force-cache + revalidate → ISR cached, fast TTFB.
    const res = await fetch(url, {
      cache: isDev ? "no-store" : "force-cache",
      ...(!isDev && { next: { revalidate: ttl } }),
      headers: WP_FETCH_HEADERS,
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`[apiFetch] ${res.status} ${res.statusText} ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[apiFetch] threw ${err instanceof Error ? err.message : err} ${url}`);
    return null;
  }
}

// ---------- posts (contents/v1 — preferred) ----------

export async function getPosts(params: {
  perPage?: number;
  page?: number;
  categories?: number | number[];
  author?: number | number[];
  tags?: number | number[];
  tagSlug?: string;
  exclude?: number[];
  search?: string;
  embed?: boolean;
} = {}): Promise<WPPost[]> {
  if (usePayload) return cms.getPosts(params);
  const sp = new URLSearchParams();
  sp.set("per_page", String(params.perPage ?? 12));
  if (params.page) sp.set("page", String(params.page));
  if (params.categories) {
    sp.set(
      "categories",
      Array.isArray(params.categories) ? params.categories.join(",") : String(params.categories),
    );
  }
  if (params.author) {
    sp.set(
      "author",
      Array.isArray(params.author) ? params.author.join(",") : String(params.author),
    );
  }
  if (params.tags) {
    sp.set(
      "tags",
      Array.isArray(params.tags) ? params.tags.join(",") : String(params.tags),
    );
  }
  if (params.tagSlug) sp.set("tag_slug", params.tagSlug);
  if (params.exclude?.length) sp.set("exclude", params.exclude.join(","));
  if (params.search) sp.set("search", params.search);

  const data = await apiFetch<WPPost[]>(`${CONTENTS_BASE}/posts?${sp.toString()}`);
  return data ?? [];
}

/**
 * A window of posts by OFFSET plus the total matching count, for listings
 * whose first page is bigger than the rest (category/author: 17 then 12).
 */
export async function getPostsWindow(params: {
  offset: number;
  limit: number;
  categories?: number;
  author?: number;
  tags?: number;
  tagSlug?: string;
}): Promise<{ posts: WPPost[]; total: number }> {
  if (usePayload) return cms.findPostsWindow(params);
  const sp = new URLSearchParams();
  sp.set("per_page", String(params.limit));
  if (params.offset > 0) sp.set("offset", String(params.offset));
  if (params.categories) sp.set("categories", String(params.categories));
  if (params.author) sp.set("author", String(params.author));
  if (params.tags) sp.set("tags", String(params.tags));
  if (params.tagSlug) sp.set("tag_slug", params.tagSlug);
  const url = `${CONTENTS_BASE}/posts?${sp.toString()}`;
  try {
    const res = await fetch(url, {
      cache: isDev ? "no-store" : "force-cache",
      ...(!isDev && { next: { revalidate: REVALIDATE } }),
      headers: WP_FETCH_HEADERS,
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`[getPostsWindow] ${res.status} ${res.statusText} ${url}`);
      return { posts: [], total: 0 };
    }
    const posts = (await res.json()) as WPPost[];
    const total = parseInt(res.headers.get("x-wp-total") || "", 10);
    return { posts: Array.isArray(posts) ? posts : [], total: Number.isFinite(total) ? total : posts.length };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[getPostsWindow] threw ${err instanceof Error ? err.message : err} ${url}`);
    return { posts: [], total: 0 };
  }
}

/** Raw /wp/v2 item of a page or a custom post type (program). */
type WPV2Item = Omit<Partial<WPPost>, "id" | "featured_media"> & {
  id: number | string;
  featured_media?: number | string;
};

/** Shape a /wp/v2/{pages,program} item (fetched with _embed) like a contents/v1 post. */
function v2ToPost(raw: WPV2Item, pathname: string, type?: string): WPPost {
  return {
    ...raw,
    type: type ?? raw.type,
    id: Number(raw.id),
    date: raw.date ?? "",
    modified: raw.modified ?? raw.date ?? "",
    slug: raw.slug ?? "",
    link: `${SITE_ORIGIN}${pathname}`,
    pathname,
    title: raw.title ?? { rendered: "" },
    excerpt: raw.excerpt ?? { rendered: "" },
    content: raw.content ?? { rendered: "" },
    author: Number(raw.author ?? 0),
    featured_media: Number(raw.featured_media ?? 0),
    categories: [],
    tags: [],
    primary_category: undefined,
  };
}

function pathOf(link: string | undefined): string | null {
  if (!link) return null;
  try {
    return new URL(link).pathname.replace(/\/$/, "") || null;
  } catch {
    return null;
  }
}

/** Site path of a post/page/program by WordPress id (for /?p=ID short links). */
export async function getPostPathById(id: number): Promise<string | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  if (usePayload) return cms.getPostPathById(id);
  const posts = await apiFetch<WPPost[]>(`${CONTENTS_BASE}/posts?include=${id}&per_page=1`);
  const post = posts?.find((p) => Number(p.id) === id);
  if (post) return post.pathname?.startsWith("/") ? post.pathname.replace(/\/$/, "") : pathOf(post.link);
  for (const type of ["pages", "program"]) {
    const item = await apiFetch<{ id: number; link?: string }>(`${WP_V2_BASE}/${type}/${id}?_fields=id,link`);
    const path = pathOf(item?.link);
    if (path) return path;
  }
  return null;
}

/** SEO overrides (Yoast values): CMS `meta` in Payload mode, the WordPress page head otherwise. */
export type PostSeo = NonNullable<cms.CMSPost["_seo"]> & { ogImage?: string | null };

// ---------- Yoast SEO (WordPress mode) ----------
//
// Yoast's REST output (yoast_head_json, /yoast/v1/get_head) is switched off
// on the WordPress side, so the only place its title/description live is the
// rendered page <head>. We read the page from WP_API_ORIGIN (always the
// WordPress server in this mode — the REST API comes from the same host),
// stop at </head>, keep only the few fields we use, and cache that small
// object. Pages without Yoast's marker comment are ignored, so this can never
// pick up our own markup.

const YOAST_TTL = 3600;
const BRAND_SUFFIX = /\s*[|\-–—]\s*Bright\s*TV\s*$/i;

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? (m[2] ?? m[3]) : undefined;
}

function findTag(head: string, re: RegExp): string | undefined {
  return head.match(re)?.[0];
}

export function parseYoastHead(head: string): PostSeo {
  const meta = (key: "name" | "property", value: string) => {
    const tag = findTag(head, new RegExp(`<meta[^>]*\\s${key}=["']${value}["'][^>]*>`, "i"));
    const v = tag ? attr(tag, "content") : undefined;
    return v ? decodeEntities(v).trim() : undefined;
  };
  const rawTitle = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = (rawTitle ? decodeEntities(rawTitle).trim() : meta("property", "og:title"))?.replace(BRAND_SUFFIX, "");
  let description = (meta("name", "description") ?? meta("property", "og:description"))?.replace(BRAND_SUFFIX, "");
  // "เกี่ยวกับเรา - Bright TV" is just the title again: not a description.
  if (description && title && description === title) description = undefined;
  const canonTag = findTag(head, /<link[^>]*\srel=["']canonical["'][^>]*>/i);
  const canonical = canonTag ? attr(canonTag, "href") : undefined;
  const robots = meta("name", "robots") ?? "";
  return {
    title: title || null,
    description: description || null,
    canonical: canonical ? decodeEntities(canonical) : null,
    noindex: /\bnoindex\b/i.test(robots),
    nofollow: /\bnofollow\b/i.test(robots),
    ogImage: meta("property", "og:image") ?? null,
  };
}

/** Throws on network/HTTP failure so unstable_cache doesn't keep the miss. */
async function fetchYoastHead(path: string): Promise<PostSeo | null> {
  const res = await fetch(`${WP_API_ORIGIN}${path}`, {
    headers: { ...WP_FETCH_HEADERS, Accept: "text/html" },
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
  if (res.status === 404 || (res.status >= 300 && res.status < 400)) return null;
  if (!res.ok || !res.body) throw new Error(`yoast head ${res.status} ${path}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  try {
    while (html.length < 400_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      const end = html.search(/<\/head>/i);
      if (end >= 0) {
        html = html.slice(0, end);
        break;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  if (!/Yoast SEO/i.test(html)) return null;
  return parseYoastHead(html);
}

const yoastHeadCached = unstable_cache(fetchYoastHead, ["wp-yoast-head-v1"], { revalidate: YOAST_TTL });

async function getYoastSeo(path: string | undefined): Promise<PostSeo | null> {
  if (!path?.startsWith("/")) return null;
  try {
    return await yoastHeadCached(path);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[yoast] ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/** Attach the Yoast values of a WordPress post/page as `_seo`. */
async function withYoast<T extends WPPost>(post: T): Promise<T & { _seo?: PostSeo | null }> {
  const path = post.pathname?.startsWith("/") ? post.pathname : (pathOf(post.link) ?? undefined);
  return { ...post, _seo: await getYoastSeo(path) };
}

/** `section`: first URL segment — /program/{slug} and /lottery/{slug} are their own types in the CMS. */
export async function getPostBySlug(slug: string, section?: string): Promise<(WPPost & { _seo?: PostSeo | null }) | null> {
  if (usePayload) {
    if (section === "program" || section === "lottery") return cms.getSpecialBySlug(section, slug);
    // /{slug} alone may be a static page.
    const post = await cms.getPostBySlug(slug);
    if (post) return post;
    const page = section === slug ? await cms.getPageBySlug(slug) : null;
    return page ? { ...page, type: "page" } : null;
  }
  const sp = new URLSearchParams();
  sp.set("slug", slug);
  // /program/{slug} is its own post type in WordPress (a news post may share the slug).
  if (section === "program") {
    const items = await apiFetch<WPV2Item[]>(`${WP_V2_BASE}/program?${sp.toString()}&_embed=author,wp:featuredmedia`);
    const item = items?.[0];
    return item ? withYoast(v2ToPost(item, pathOf(item.link) ?? `/program/${slug}`, "program")) : null;
  }
  const data = await apiFetch<WPPost[]>(`${CONTENTS_BASE}/posts?${sp.toString()}`);
  if (data && data.length) return withYoast(data[0]);
  // /{slug} alone may be a static page (about-us, privacy-policy, …).
  if (section === slug) {
    const pages = await apiFetch<WPV2Item[]>(`${WP_V2_BASE}/pages?${sp.toString()}&_embed=author,wp:featuredmedia`);
    const page = pages?.[0];
    if (page) return withYoast(v2ToPost(page, pathOf(page.link) ?? `/${slug}`, "page"));
  }
  return null;
}

/**
 * Pixel sizes of attachments by id (article body `<img class="wp-image-ID">`
 * tags often lack width/height). One cached request per article.
 */
export async function getMediaSizes(ids: number[]): Promise<Record<number, { width: number; height: number }>> {
  const uniq = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b).slice(0, 100);
  if (usePayload || !uniq.length) return {};
  const items = await apiFetch<Array<{ id: number; media_details?: { width?: number; height?: number } }>>(
    `${WP_V2_BASE}/media?include=${uniq.join(",")}&per_page=100&_fields=id,media_details`,
    86400,
  );
  const out: Record<number, { width: number; height: number }> = {};
  for (const m of items ?? []) {
    const w = m.media_details?.width;
    const h = m.media_details?.height;
    if (w && h) out[m.id] = { width: w, height: h };
  }
  return out;
}

// ---------- taxonomies (still wp/v2) ----------

export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  if (usePayload) return cms.getCategoryBySlug(slug);
  const data = await apiFetch<WPCategory[]>(
    `${WP_V2_BASE}/categories?slug=${encodeURIComponent(slug)}`,
  );
  return data && data.length ? data[0] : null;
}

export async function getCategories(perPage = 100): Promise<WPCategory[]> {
  if (usePayload) return cms.getCategories(perPage);
  return (await apiFetch<WPCategory[]>(`${WP_V2_BASE}/categories?per_page=${perPage}`)) ?? [];
}

export async function getPopularTags(perPage = 20): Promise<WPTag[]> {
  if (usePayload) return cms.getPopularTags(perPage);
  return (
    (await apiFetch<WPTag[]>(`${WP_V2_BASE}/tags?orderby=count&order=desc&per_page=${perPage}`)) ?? []
  );
}

/**
 * A tag by slug (raw Thai or percent-encoded, either case), or null. Listings
 * query by its id: contents/v1 ignores an unmatched `tag_slug` and returns
 * every post, which made unknown/empty tags soft 404s.
 */
export async function getTagBySlug(slug: string): Promise<WPTag | null> {
  if (usePayload) return cms.getTagBySlug(slug);
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    // keep as is
  }
  const data = await apiFetch<WPTag[]>(`${WP_V2_BASE}/tags?slug=${encodeURIComponent(s)}&_fields=id,count,name,slug,link`);
  return data && data.length ? data[0] : null;
}

// ---------- users (still wp/v2) ----------

export async function getUserBySlug(slug: string): Promise<WPUser | null> {
  if (usePayload) return cms.getUserBySlug(slug);
  const data = await apiFetch<WPUser[]>(
    `${WP_V2_BASE}/users?slug=${encodeURIComponent(slug)}`,
  );
  return data && data.length ? data[0] : null;
}

// ---------- lottery (D1, filled by apps/lotto) ----------

/** Latest draw, in the shape the home page block uses (date as Thai text). */
export async function getLottoLatest(): Promise<LottoResult | null> {
  const draw = await getLatestDraw();
  return draw ? { date: thaiDate(draw.date), prizes: draw.prizes, runningNumbers: draw.runningNumbers } : null;
}

// ---------- Bright custom sidebar endpoint ----------

export async function getMostViewPosts(): Promise<SidebarPost[]> {
  if (usePayload) {
    // Our own view counter (lib/views.ts); until it has data, the old site's
    // list while WordPress is still up, then the latest stories.
    const ids = await topViewedIds(10);
    if (ids.length >= 5) return cms.postsByIds(ids);
    const wp = await getWordPressMostView();
    if (wp.length) return wp;
    return cms.latestSidebar(10);
  }
  return getWordPressMostView();
}

async function getWordPressMostView(): Promise<SidebarPost[]> {
  try {
    const res = await fetch(
      `${WP_API_ORIGIN}/wp-json/contents/v1/sidebar?type=mostview`,
      { next: { revalidate: REVALIDATE }, headers: WP_FETCH_HEADERS },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { mostview?: SidebarPost[] };
    return Array.isArray(data.mostview) ? data.mostview : [];
  } catch {
    return [];
  }
}

export async function getArticleSidebar(post: WPPost): Promise<SidebarResponse> {
  if (usePayload) return cms.getArticleSidebar(post, getMostViewPosts);
  const postId = post.id;
  const empty: SidebarResponse = { related: [], latest: [], mostview: [] };
  try {
    const res = await fetch(
      `${WP_API_ORIGIN}/wp-json/contents/v1/sidebar?id=${postId}`,
      { next: { revalidate: REVALIDATE }, headers: WP_FETCH_HEADERS },
    );
    if (!res.ok) return empty;
    const data = (await res.json()) as Partial<SidebarResponse>;
    return {
      related: Array.isArray(data.related) ? data.related : [],
      latest: Array.isArray(data.latest) ? data.latest : [],
      mostview: Array.isArray(data.mostview) ? data.mostview : [],
    };
  } catch {
    return empty;
  }
}

// ---------- top tags ----------

export async function getTopTags(
  opts: { isHome?: boolean } = {},
): Promise<TopTag[]> {
  if (usePayload) return cms.getTopTags();
  const url = opts.isHome
    ? `${WP_API_ORIGIN}/wp-json/contents/v1/top-tags?is_home=true`
    : `${WP_API_ORIGIN}/wp-json/contents/v1/top-tags`;
  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE },
      headers: WP_FETCH_HEADERS,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { top_tags?: TopTag[] };
    const tags = Array.isArray(data.top_tags) ? data.top_tags : [];
    return tags.map((t) => ({
      ...t,
      slug: safeDecode(t.slug),
    }));
  } catch {
    return [];
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// ---------- theme.json global styles ----------

const GLOBAL_STYLES_TTL = 21600; // 6h

export async function getGlobalStylesCss(): Promise<string> {
  // WordPress theme.json CSS, frozen at the move (WordPress goes away).
  if (usePayload) return (await import("./wp-global-styles")).WP_GLOBAL_STYLES_CSS;
  try {
    const res = await fetch(`${WP_API_ORIGIN}/wp-json/bright/v1/global-styles`, {
      next: { revalidate: GLOBAL_STYLES_TTL },
      headers: WP_FETCH_HEADERS,
    });
    if (res.ok) {
      const data = (await res.json()) as { css?: string };
      if (typeof data.css === "string" && data.css.length > 0) return data.css;
    }
  } catch {
    // fall through to scrape
  }

  try {
    const res = await fetch(`${SITE_ORIGIN}/`, {
      next: { revalidate: GLOBAL_STYLES_TTL },
      headers: WP_FETCH_HEADERS,
    });
    if (!res.ok) return "";
    const html = await res.text();
    const m = html.match(
      /<style[^>]*id=["']global-styles-inline-css["'][^>]*>([\s\S]*?)<\/style>/i,
    );
    return m ? m[1] : "";
  } catch {
    return "";
  }
}
