// WordPress REST API client for brighttv.co.th.
// This file holds ONLY type definitions and network fetchers. All pure
// conversion/formatting helpers live in `@/lib/utils`.
import { SITE_ORIGIN, WP_API_ORIGIN } from "./env";

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
// nuxt/v1/sidebar endpoint. Same shape as gallery_images items.
export type WPFeaturedImage = {
  alt?: string;
  sizes?: Partial<Record<string, WPImageSize>>;
};

export type WPAuthorInfo = {
  display_name: string;
  author_link?: string;
  nuxtlink?: string;
};

export type WPTaxonomyTerm = {
  id: number;
  name: string;
  nicename?: string;
  slug?: string;
  nuxtlink?: string;
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
  nuxtlink?: string;

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
    nuxtlink?: string;
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

// ---------- Bright "nuxt/v1/sidebar" endpoint shapes ----------

export type SidebarCategory = {
  id: number;
  name: string;
  slug: string;
  link?: string;
  nuxtlink?: string;
};

export type SidebarPost = {
  id: number;
  modified: string;
  title: WPRendered;
  excerpt: WPRendered;
  author: string;
  featured_image?: WPFeaturedImage;
  primary_category?: SidebarCategory;
  nuxtlink?: string;
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

async function apiFetch<T>(url: string, ttl = REVALIDATE): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: ttl },
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
  exclude?: number[];
  search?: string;
  embed?: boolean; // ignored — contents/v1 always includes embedded data
} = {}): Promise<WPPost[]> {
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
  if (params.exclude?.length) sp.set("exclude", params.exclude.join(","));
  if (params.search) sp.set("search", params.search);

  const data = await apiFetch<WPPost[]>(`${CONTENTS_BASE}/posts?${sp.toString()}`);
  return data ?? [];
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  const sp = new URLSearchParams();
  sp.set("slug", slug);
  const data = await apiFetch<WPPost[]>(`${CONTENTS_BASE}/posts?${sp.toString()}`);
  return data && data.length ? data[0] : null;
}

// ---------- taxonomies (still wp/v2) ----------

export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const data = await apiFetch<WPCategory[]>(
    `${WP_V2_BASE}/categories?slug=${encodeURIComponent(slug)}`,
  );
  return data && data.length ? data[0] : null;
}

export async function getCategories(perPage = 100): Promise<WPCategory[]> {
  return (await apiFetch<WPCategory[]>(`${WP_V2_BASE}/categories?per_page=${perPage}`)) ?? [];
}

export async function getPopularTags(perPage = 20): Promise<WPTag[]> {
  return (
    (await apiFetch<WPTag[]>(`${WP_V2_BASE}/tags?orderby=count&order=desc&per_page=${perPage}`)) ?? []
  );
}

// ---------- users (still wp/v2) ----------

export async function getUserBySlug(slug: string): Promise<WPUser | null> {
  const data = await apiFetch<WPUser[]>(
    `${WP_V2_BASE}/users?slug=${encodeURIComponent(slug)}`,
  );
  return data && data.length ? data[0] : null;
}

// ---------- lottery (third-party API) ----------

export async function getLottoLatest(): Promise<LottoResult | null> {
  try {
    const res = await fetch("https://lotto.api.rayriffy.com/latest", {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status !== "success") return null;
    return data.response as LottoResult;
  } catch {
    return null;
  }
}

// ---------- Bright custom sidebar endpoint ----------

export async function getMostViewPosts(): Promise<SidebarPost[]> {
  try {
    const res = await fetch(
      `${WP_API_ORIGIN}/wp-json/nuxt/v1/sidebar?type=mostview`,
      { next: { revalidate: REVALIDATE }, headers: WP_FETCH_HEADERS },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { mostview?: SidebarPost[] };
    return Array.isArray(data.mostview) ? data.mostview : [];
  } catch {
    return [];
  }
}

export async function getArticleSidebar(postId: number): Promise<SidebarResponse> {
  const empty: SidebarResponse = { related: [], latest: [], mostview: [] };
  try {
    const res = await fetch(
      `${WP_API_ORIGIN}/wp-json/nuxt/v1/sidebar?id=${postId}`,
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
  const url = opts.isHome
    ? `${WP_API_ORIGIN}/wp-json/nuxt/v1/top-tags?is_home=true`
    : `${WP_API_ORIGIN}/wp-json/nuxt/v1/top-tags`;
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
