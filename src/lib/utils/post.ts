// Pure conversion helpers for WordPress post objects. No network I/O lives
// here — see `@/lib/wp` for the API fetchers that return the raw shapes
// these helpers know how to read.
//
// Every helper reads NEW fields first (featured_image, author_info,
// taxonomies — from /contents/v1/posts) and falls back to the LEGACY
// _embedded shape (from /wp/v2/posts?_embed or sidebarPostToWPPost).
import type { SidebarPost, WPPost, WPImageSize } from "@/lib/wp";
import { stripHtml } from "./text";

// ---------- featured image ----------

// Brand-safe fallback served when a post has no featured image at all.
export const DEFAULT_FEATURED_IMAGE = {
  url: "https://cdn.brighttv.co.th/wp-content/uploads/2017/07/04102155/brighttv-default.webp",
  width: 1200,
  height: 630,
};

// Size-key priority per requested logical size. When "full" is asked for we
// walk from the biggest WP intermediate down so the hero renders crisply on
// retina displays.
const SIZE_FALLBACKS: Record<
  "thumbnail" | "medium" | "large" | "full",
  readonly string[]
> = {
  full: ["2048x2048", "1536x1536", "full", "large", "medium_large"],
  large: ["large", "medium_large", "1536x1536", "full"],
  medium: ["medium_large", "medium", "large"],
  thumbnail: ["thumbnail", "medium"],
};

export function getFeaturedImage(
  post: WPPost,
  size: "thumbnail" | "medium" | "large" | "full" = "large",
) {
  // 1. Prefer the NEW top-level featured_image from contents/v1.
  if (post.featured_image?.sizes) {
    const sizes = post.featured_image.sizes;
    let picked: WPImageSize | undefined;
    for (const key of SIZE_FALLBACKS[size]) {
      const s = sizes[key];
      if (s?.src) {
        picked = s;
        break;
      }
    }
    if (picked) {
      return {
        url: picked.src,
        width: picked.width || DEFAULT_FEATURED_IMAGE.width,
        height: picked.height || DEFAULT_FEATURED_IMAGE.height,
        alt: post.featured_image.alt || stripHtml(post.title.rendered),
      };
    }
  }

  // 2. Fallback to legacy _embedded (from wp/v2?_embed or sidebarPostToWPPost).
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  if (media) {
    const embeddedSizes = media.media_details?.sizes;
    let picked: { source_url: string; width?: number; height?: number } | undefined;
    for (const key of SIZE_FALLBACKS[size]) {
      const s = embeddedSizes?.[key];
      if (s?.source_url) {
        picked = s;
        break;
      }
    }
    return {
      url:
        picked?.source_url || media.source_url || DEFAULT_FEATURED_IMAGE.url,
      width:
        picked?.width ||
        media.media_details?.width ||
        DEFAULT_FEATURED_IMAGE.width,
      height:
        picked?.height ||
        media.media_details?.height ||
        DEFAULT_FEATURED_IMAGE.height,
      alt: media.alt_text || stripHtml(post.title.rendered),
    };
  }

  // 3. No image at all.
  return { ...DEFAULT_FEATURED_IMAGE, alt: stripHtml(post.title.rendered) };
}

// ---------- primary category ----------

export function getPrimaryCategory(post: WPPost) {
  // 1. Yoast primary_category (both old and new endpoints expose this).
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
  // 2. NEW taxonomies.categories from contents/v1.
  const taxCats = post.taxonomies?.categories;
  if (taxCats?.length) {
    const c = taxCats[0];
    const slug = c.nicename || c.slug || "";
    return {
      id: c.id,
      name: c.name,
      slug,
      taxonomy: "category",
      link: c.nuxtlink || `/category/${slug}`,
    };
  }
  // 3. Legacy _embedded terms.
  const terms = post._embedded?.["wp:term"]?.[0] || [];
  const filtered = terms.filter((t) => !["uncategorized"].includes(t.slug));
  return filtered[0] || terms[0] || null;
}

// ---------- author ----------

export function getAuthorName(post: WPPost): string {
  // Prefer contents/v1's author_info.
  if (post.author_info?.display_name) return post.author_info.display_name;
  // Legacy _embedded.
  return post._embedded?.author?.[0]?.name || "กองบรรณาธิการ";
}

export function getAuthorUrl(post: WPPost): string | null {
  // Prefer contents/v1's author_info.
  if (post.author_info?.author_link) return post.author_info.author_link;
  if (post.author_info?.nuxtlink)
    return `https://www.brighttv.co.th${post.author_info.nuxtlink}`;
  // Legacy _embedded.
  const a = post._embedded?.author?.[0];
  if (!a) return null;
  if (a.link) return a.link;
  if (a.slug) return `https://www.brighttv.co.th/author/${a.slug}`;
  return null;
}

// ---------- post path ----------

/**
 * Derive a site-relative path for a post.
 * Prefers the `nuxtlink` field (already site-relative on both endpoints).
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

// ---------- video ----------

export function hasVideo(post: WPPost): boolean {
  return getYoutubeId(post) !== null;
}

// Returns a clean YouTube video id, or null if absent/invalid.
// Checks contents/v1's `video` field first, then legacy `acf.youtube_id`.
export function getYoutubeId(post: WPPost): string | null {
  // 1. New `video` field from contents/v1.
  const vid = post.video;
  if (typeof vid === "string" && vid.trim().length > 0 && vid !== "0") {
    const cleaned = vid.trim();
    if (/^[\w-]{11}$/.test(cleaned)) return cleaned;
    const m = cleaned.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{11})/);
    if (m) return m[1];
  }
  // 2. Legacy acf.youtube_id.
  const raw = post.acf?.youtube_id;
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "0") return null;
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// ---------- sidebar adapter ----------

// Adapt a SidebarPost (Bright's custom /nuxt/v1/sidebar shape) into a
// WPPost-shaped object so it can be passed straight into ArticleCard /
// other components. The adapter populates BOTH the new featured_image
// field AND the legacy _embedded shape so every helper works regardless.
export function sidebarPostToWPPost(s: SidebarPost): WPPost {
  const sizes = s.featured_image?.sizes ?? {};
  type SizeEntry = { ID?: number; width: number; height: number; src: string };
  const pickSize = (key: string): SizeEntry | undefined => sizes[key];
  const fullSize =
    pickSize("full") ?? pickSize("large") ?? pickSize("medium_large");

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
                .filter(
                  (entry): entry is [string, SizeEntry] => entry[1] != null,
                )
                .map(([k, v]) => [
                  k,
                  { source_url: v.src, width: v.width, height: v.height },
                ]),
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
    // Populate BOTH new and legacy fields for full compat.
    featured_image: s.featured_image,
    author_info: s.author
      ? { display_name: s.author }
      : undefined,
    _embedded: {
      author: s.author ? [{ id: 0, name: s.author }] : undefined,
      "wp:featuredmedia": featuredMedia,
    },
  };
}
