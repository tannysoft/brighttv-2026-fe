// Content fetchers for brighttv.co.th: the WordPress REST API, or the new
// Payload CMS when CMS_SOURCE=payload (./payload.ts returns the same shapes).
// This file holds ONLY type definitions and network fetchers. All pure
// conversion/formatting helpers live in `@/lib/utils`.
import { getLatestDraw } from "./lotto";
import { thaiDate } from "./lotto-check";
import { CMS_SOURCE, SITE_ORIGIN, WP_API_ORIGIN } from "./env";
import * as cms from "./payload";
import { topViewedIds } from "./views";

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
  tagSlug?: string;
}): Promise<{ posts: WPPost[]; total: number }> {
  if (usePayload) return cms.findPostsWindow(params);
  const sp = new URLSearchParams();
  sp.set("per_page", String(params.limit));
  if (params.offset > 0) sp.set("offset", String(params.offset));
  if (params.categories) sp.set("categories", String(params.categories));
  if (params.author) sp.set("author", String(params.author));
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
function v2ToPost(raw: WPV2Item, pathname: string): WPPost {
  return {
    ...raw,
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

/** `section`: first URL segment — /program/{slug} and /lottery/{slug} are their own types in the CMS. */
export async function getPostBySlug(slug: string, section?: string): Promise<(WPPost & { _seo?: cms.CMSPost["_seo"] }) | null> {
  if (usePayload) {
    if (section === "program" || section === "lottery") return cms.getSpecialBySlug(section, slug);
    // /{slug} alone may be a static page.
    return (await cms.getPostBySlug(slug)) ?? (section === slug ? cms.getPageBySlug(slug) : null);
  }
  const sp = new URLSearchParams();
  sp.set("slug", slug);
  // /program/{slug} is its own post type in WordPress (a news post may share the slug).
  if (section === "program") {
    const items = await apiFetch<WPV2Item[]>(`${WP_V2_BASE}/program?${sp.toString()}&_embed=author,wp:featuredmedia`);
    const item = items?.[0];
    return item ? v2ToPost(item, pathOf(item.link) ?? `/program/${slug}`) : null;
  }
  const data = await apiFetch<WPPost[]>(`${CONTENTS_BASE}/posts?${sp.toString()}`);
  if (data && data.length) return data[0];
  // /{slug} alone may be a static page (about-us, privacy-policy, …).
  if (section === slug) {
    const pages = await apiFetch<WPV2Item[]>(`${WP_V2_BASE}/pages?${sp.toString()}&_embed=author,wp:featuredmedia`);
    const page = pages?.[0];
    if (page) return v2ToPost(page, pathOf(page.link) ?? `/${slug}`);
  }
  return null;
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
