// Pure conversion helpers for WordPress post objects. No network I/O lives
// here — see `@/lib/wp` for the API fetchers that return the raw shapes
// these helpers know how to read.
import type { SidebarPost, WPPost } from "@/lib/wp";
import { stripHtml } from "./text";

// Brand-safe fallback served when a post has no featured image at all.
export const DEFAULT_FEATURED_IMAGE = {
  url: "https://cdn.brighttv.co.th/wp-content/uploads/2017/07/04102155/brighttv-default.webp",
  width: 1200,
  height: 630,
};

// Resolve the best URL for a post's featured image at the requested size.
// Falls back to the default brand image when the post is missing media.
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

export function getAuthorName(post: WPPost): string {
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

// Adapt a SidebarPost (Bright's custom /nuxt/v1/sidebar shape) into a
// WPPost-shaped object so it can be passed straight into ArticleCard / other
// components without a separate renderer. Fields the sidebar API doesn't
// return (categories, primary_category, full author info) are filled with
// safe defaults — ArticleCard already guards on `cat &&` and `hasVideo()`
// returning false on absent acf, so they degrade gracefully.
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
            // TS 5.x disallows type predicates on destructured params, so
            // name the whole tuple and narrow via a normal guard instead.
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
    _embedded: {
      author: s.author ? [{ id: 0, name: s.author }] : undefined,
      "wp:featuredmedia": featuredMedia,
    },
  };
}
