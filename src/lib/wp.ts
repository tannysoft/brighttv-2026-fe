// WordPress REST API client for brighttv.co.th
const WP_BASE = "https://www.brighttv.co.th/wp-json/wp/v2";
const REVALIDATE = 300; // 5 minutes ISR

export type WPRendered = { rendered: string; protected?: boolean };

export type WPPost = {
  id: number;
  date: string;
  modified: string;
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
    author?: Array<{ id: number; name: string; avatar_urls?: Record<string, string> }>;
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

async function wpFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const url = `${WP_BASE}${path}`;
    const res = await fetch(url, {
      ...init,
      next: { revalidate: REVALIDATE },
      headers: { Accept: "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getPosts(params: {
  perPage?: number;
  page?: number;
  categories?: number | number[];
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
  if (params.exclude?.length) sp.set("exclude", params.exclude.join(","));
  if (params.search) sp.set("search", params.search);
  if (params.embed !== false) sp.set("_embed", "1");
  const data = await wpFetch<WPPost[]>(`/posts?${sp.toString()}`);
  return data ?? [];
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  const sp = new URLSearchParams();
  sp.set("slug", slug);
  sp.set("_embed", "1");
  const data = await wpFetch<WPPost[]>(`/posts?${sp.toString()}`);
  return data && data.length ? data[0] : null;
}

export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const data = await wpFetch<WPCategory[]>(`/categories?slug=${encodeURIComponent(slug)}`);
  return data && data.length ? data[0] : null;
}

export async function getCategories(perPage = 100): Promise<WPCategory[]> {
  return (await wpFetch<WPCategory[]>(`/categories?per_page=${perPage}`)) ?? [];
}

export type WPTag = {
  id: number;
  count: number;
  name: string;
  slug: string;
  link: string;
};

export type LottoPrize = { id: string; name: string; reward: string; amount: number; number: string[] };
export type LottoResult = {
  date: string;
  prizes: LottoPrize[];
  runningNumbers: LottoPrize[];
};

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

// ---------- Article sidebar (custom Bright endpoint) ----------
// /wp-json/nuxt/v1/sidebar?id={postId} returns { related, latest, mostview }
// — flat post arrays in a Bright-specific shape (different from /wp/v2/posts).
type SidebarImageSize = { ID?: number; width: number; height: number; src: string };
type SidebarCategory = {
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
    sizes?: Partial<Record<string, SidebarImageSize>>;
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

// Fetch only the most-viewed posts from the same Bright sidebar endpoint.
// Omit `id` and pass `type=mostview` to get a site-wide trending list.
export async function getMostViewPosts(): Promise<SidebarPost[]> {
  try {
    const res = await fetch(
      "https://www.brighttv.co.th/wp-json/nuxt/v1/sidebar?type=mostview",
      { next: { revalidate: REVALIDATE }, headers: { Accept: "application/json" } },
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
      `https://www.brighttv.co.th/wp-json/nuxt/v1/sidebar?id=${postId}`,
      { next: { revalidate: REVALIDATE }, headers: { Accept: "application/json" } },
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

// Adapt a SidebarPost into a WPPost-shaped object so it can be passed straight
// into ArticleCard / other components without a separate renderer. Fields the
// sidebar API doesn't return (categories, primary_category, full author info)
// are filled with safe defaults — ArticleCard already guards on `cat &&` and
// `hasVideo()` returning false on absent acf, so they degrade gracefully.
export function sidebarPostToWPPost(s: SidebarPost): WPPost {
  const sizes = s.featured_image?.sizes ?? {};
  const pickSize = (key: string): SidebarImageSize | undefined => sizes[key];
  const fullSize = pickSize("full") ?? pickSize("large") ?? pickSize("medium_large");
  const featuredMedia = fullSize
    ? [
        {
          id: fullSize.ID ?? 0,
          source_url: fullSize.src,
          alt_text: s.featured_image?.alt ?? "",
          media_details: {
            width: fullSize.width,
            height: fullSize.height,
            sizes: Object.fromEntries(
              Object.entries(sizes)
                .filter(([, v]): v is SidebarImageSize => Boolean(v))
                .map(([k, v]) => [k, { source_url: v.src, width: v.width, height: v.height }]),
            ),
          },
        },
      ]
    : undefined;

  // WPPost.primary_category uses `nicename`; sidebar API uses `slug`. Remap.
  const primary_category = s.primary_category
    ? [
        {
          id: s.primary_category.id,
          name: s.primary_category.name,
          nicename: s.primary_category.slug,
          nuxtlink: s.primary_category.nuxtlink,
        },
      ]
    : undefined;

  return {
    id: s.id,
    date: s.modified,
    modified: s.modified,
    slug: "",
    link: "",
    title: s.title,
    excerpt: s.excerpt,
    content: { rendered: "" },
    author: 0,
    featured_media: featuredMedia?.[0]?.id ?? 0,
    categories: s.primary_category ? [s.primary_category.id] : [],
    tags: [],
    nuxtlink: s.nuxtlink,
    views: s.views,
    primary_category,
    _embedded: {
      author: s.author ? [{ id: 0, name: s.author }] : undefined,
      "wp:featuredmedia": featuredMedia,
    },
  };
}

// Format a raw view count (string|number) with thousands separators.
// Returns "" when the value is missing, zero, or not a finite number.
export function formatViews(views: string | number | undefined): string {
  if (views == null) return "";
  const n = typeof views === "number" ? views : parseInt(views, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("en-US");
}

export async function getPopularTags(perPage = 20): Promise<WPTag[]> {
  return (
    (await wpFetch<WPTag[]>(`/tags?orderby=count&order=desc&per_page=${perPage}`)) ?? []
  );
}

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
const SITE_ORIGIN = "https://www.brighttv.co.th";

export async function getGlobalStylesCss(): Promise<string> {
  // 1. Preferred: dedicated REST endpoint that calls wp_get_global_stylesheet()
  try {
    const res = await fetch(`${SITE_ORIGIN}/wp-json/bright/v1/global-styles`, {
      next: { revalidate: GLOBAL_STYLES_TTL },
      headers: { Accept: "application/json" },
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
      headers: { "User-Agent": "BrightTV-Headless/1.0" },
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

// ---------- helpers ----------
// Brand-safe fallback served when a post has no featured image at all.
export const DEFAULT_FEATURED_IMAGE = {
  url: "https://cdn.brighttv.co.th/wp-content/uploads/2017/07/04102155/brighttv-default.webp",
  width: 1200,
  height: 630,
};

export function getFeaturedImage(
  post: WPPost,
  size: "thumbnail" | "medium" | "large" | "full" = "large",
) {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!media) {
    return {
      ...DEFAULT_FEATURED_IMAGE,
      alt: stripHtml(post.title.rendered),
    };
  }
  const sized = media.media_details?.sizes?.[size]?.source_url;
  return {
    url: sized || media.source_url || DEFAULT_FEATURED_IMAGE.url,
    width:
      media.media_details?.sizes?.[size]?.width ||
      media.media_details?.width ||
      DEFAULT_FEATURED_IMAGE.width,
    height:
      media.media_details?.sizes?.[size]?.height ||
      media.media_details?.height ||
      DEFAULT_FEATURED_IMAGE.height,
    alt: media.alt_text || stripHtml(post.title.rendered),
  };
}

export function getPrimaryCategory(post: WPPost) {
  // Prefer Yoast primary category exposed by the WP API
  const primary = post.primary_category?.[0];
  if (primary) {
    return {
      id: primary.id,
      name: primary.name,
      slug: primary.nicename,
      taxonomy: "category",
      link: primary.nuxtlink || `/category/${primary.nicename}`,
    };
  }
  // Fallback: first embedded term
  const terms = post._embedded?.["wp:term"]?.[0] || [];
  const filtered = terms.filter((t) => !["uncategorized"].includes(t.slug));
  return filtered[0] || terms[0] || null;
}

export function hasVideo(post: WPPost): boolean {
  return getYoutubeId(post) !== null;
}

// Returns a clean YouTube video id from acf.youtube_id, or null if absent/invalid.
// Accepts a raw 11-char id, or a full youtube.com / youtu.be URL.
export function getYoutubeId(post: WPPost): string | null {
  const raw = post.acf?.youtube_id;
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "0") return null;
  // Plain id (most common case in this dataset)
  if (/^[\w-]{11}$/.test(s)) return s;
  // Try to parse a URL form
  const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function getAuthorName(post: WPPost) {
  return post._embedded?.author?.[0]?.name || "กองบรรณาธิการ";
}

/**
 * Derive a site-relative path for a post.
 * Prefers the WordPress REST API's `nuxtlink` field (already site-relative).
 * Falls back to parsing `link`, then `/{slug}`.
 */
export function getPostPath(post: WPPost): string {
  if (post.nuxtlink && post.nuxtlink.startsWith("/")) {
    return post.nuxtlink.replace(/\/$/, "") || `/${post.slug}`;
  }
  try {
    if (post.link) {
      const u = new URL(post.link);
      return u.pathname.replace(/\/$/, "") || `/${post.slug}`;
    }
  } catch {
    // ignore
  }
  return `/${post.slug}`;
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#[0-9]+;/g, "")
    .trim();
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export function thaiDate(iso: string, opts: { withTime?: boolean; short?: boolean } = {}) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const months = opts.short ? THAI_MONTHS_SHORT : THAI_MONTHS;
  const month = months[d.getMonth()];
  const year = d.getFullYear() + 543;
  const base = `${day} ${month} ${year}`;
  if (!opts.withTime) return base;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  // Middle-dot separator (U+00B7) reads faster than a plain space between
  // the date and time segments on card meta rows.
  return `${base} · ${hh}:${mm} น.`;
}

// Relative timestamp for cards. Only within the last 8 hours we show a
// "X ชั่วโมง/นาทีที่แล้ว" label — beyond that the absolute short Thai date
// with time is more informative than an increasingly vague "3 days ago".
export function timeAgoTH(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "เมื่อสักครู่";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 8) return `${hr} ชั่วโมงที่แล้ว`;
  return thaiDate(iso, { short: true, withTime: true });
}
