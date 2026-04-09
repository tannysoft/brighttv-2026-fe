// WordPress REST API client for brighttv.co.th.
// This file holds ONLY type definitions and network fetchers. All pure
// conversion/formatting helpers live in `@/lib/utils`.
import { SITE_ORIGIN, WP_API_ORIGIN } from "./env";

const WP_BASE = `${WP_API_ORIGIN}/wp-json/wp/v2`;
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
  // Optional view count provided by Bright's custom sidebar endpoint.
  // Only populated on posts that came through sidebarPostToWPPost().
  views?: string | number;
  // Top-level image gallery exposed by the WP REST API (not inside acf).
  gallery_images?: Array<{
    id: number;
    alt: string;
    sizes: Partial<
      Record<string, { ID?: number; width: number; height: number; src: string }>
    >;
  }>;
  acf?: {
    youtube_id?: string | number | null;
    [key: string]: unknown;
  };
  primary_category?: Array<{
    id: number;
    name: string;
    nicename: string;
    nuxtlink?: string;
  }>;
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
  featured_image?: {
    alt?: string;
    sizes?: Partial<
      Record<string, { ID?: number; width: number; height: number; src: string }>
    >;
  };
  primary_category?: SidebarCategory;
  nuxtlink?: string;
  views?: string | number;
};

export type SidebarResponse = {
  related: SidebarPost[];
  latest: SidebarPost[];
  mostview: SidebarPost[];
};

// ---------- internal ----------

async function wpFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const url = `${WP_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      next: { revalidate: REVALIDATE },
      headers: { ...WP_FETCH_HEADERS, ...(init?.headers || {}) },
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(`[wpFetch] ${res.status} ${res.statusText} ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[wpFetch] threw ${err instanceof Error ? err.message : err} ${url}`);
    return null;
  }
}

// ---------- posts ----------

export async function getPosts(params: {
  perPage?: number;
  page?: number;
  categories?: number | number[];
  author?: number | number[];
  exclude?: number[];
  search?: string;
  embed?: boolean;
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
  if (params.embed !== false) sp.set("_embed", "1");
  const data = await wpFetch<WPPost[]>(`/posts?${sp.toString()}`);
  return data ?? [];
}

export async function getUserBySlug(slug: string): Promise<WPUser | null> {
  const data = await wpFetch<WPUser[]>(
    `/users?slug=${encodeURIComponent(slug)}`,
  );
  return data && data.length ? data[0] : null;
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  const sp = new URLSearchParams();
  sp.set("slug", slug);
  sp.set("_embed", "1");
  const data = await wpFetch<WPPost[]>(`/posts?${sp.toString()}`);
  return data && data.length ? data[0] : null;
}

// ---------- taxonomies ----------

export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const data = await wpFetch<WPCategory[]>(`/categories?slug=${encodeURIComponent(slug)}`);
  return data && data.length ? data[0] : null;
}

export async function getCategories(perPage = 100): Promise<WPCategory[]> {
  return (await wpFetch<WPCategory[]>(`/categories?per_page=${perPage}`)) ?? [];
}

export async function getPopularTags(perPage = 20): Promise<WPTag[]> {
  return (
    (await wpFetch<WPTag[]>(`/tags?orderby=count&order=desc&per_page=${perPage}`)) ?? []
  );
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

// Fetch only the most-viewed posts from Bright's custom sidebar endpoint.
// Omit `id` and pass `type=mostview` to get a site-wide trending list.
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

// Top trending tags across recently-scanned posts. Backs the "แท็กยอดนิยม"
// widget in the article page sidebar. Tag slugs come back percent-encoded
// from the WP endpoint; we decode them once here so Link/href works with
// plain Thai text.
export type TopTag = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

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

// ---------- theme.json global styles ----------

// WordPress's `<style id="global-styles-inline-css">` block is built from
// theme.json and defines the `--wp--preset--*` CSS variables + base block
// styles that any Gutenberg `post.content.rendered` markup depends on. We
// fetch it from a small custom REST endpoint (preferred), and fall back to
// scraping the home page HTML if the endpoint is not deployed yet.
//
// WP-side endpoint (mu-plugin):
//   register_rest_route('bright/v1', '/global-styles', [
//     'methods'  => 'GET',
//     'permission_callback' => '__return_true',
//     'callback' => fn() => ['css' => wp_get_global_stylesheet()],
//   ]);
const GLOBAL_STYLES_TTL = 21600; // 6h

export async function getGlobalStylesCss(): Promise<string> {
  // 1. Preferred: dedicated REST endpoint that calls wp_get_global_stylesheet()
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

  // 2. Fallback: scrape the home page HTML and pull out the inline block.
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
