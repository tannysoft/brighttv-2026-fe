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

export async function getPopularTags(perPage = 20): Promise<WPTag[]> {
  return (
    (await wpFetch<WPTag[]>(`/tags?orderby=count&order=desc&per_page=${perPage}`)) ?? []
  );
}

// ---------- helpers ----------
export function getFeaturedImage(post: WPPost, size: "thumbnail" | "medium" | "large" | "full" = "large") {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!media) return null;
  const sized = media.media_details?.sizes?.[size]?.source_url;
  return {
    url: sized || media.source_url,
    width: media.media_details?.sizes?.[size]?.width || media.media_details?.width || 1200,
    height: media.media_details?.sizes?.[size]?.height || media.media_details?.height || 800,
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
  return `${base} ${hh}:${mm} น.`;
}

export function timeAgoTH(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "เมื่อสักครู่";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} วันที่แล้ว`;
  return thaiDate(iso, { short: true });
}
