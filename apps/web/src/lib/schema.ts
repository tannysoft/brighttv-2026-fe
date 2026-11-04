// JSON-LD schema generators for SEO.
// All schemas reference https://schema.org and are rendered as <script type="application/ld+json">.
import { SITE_ORIGIN } from "./env";

const SITE_URL = SITE_ORIGIN;
export const SITE_NAME = "BRIGHT TV";
/** X/Twitter handle for twitter:site. */
export const TWITTER_SITE = "@BrightTv20";
/** Site-wide share image (JPEG: some share scrapers don't take WebP). */
export const DEFAULT_OG_IMAGE = {
  url: "https://cdn.brighttv.co.th/wp-content/uploads/2017/07/04102155/brighttv-default.jpg",
  width: 1200,
  height: 630,
  alt: "BRIGHT TV",
};
// Raster (Google ignores SVG logos): public/logo-600.png, rendered from logo.svg.
const LOGO_URL = `${SITE_URL}/logo-600.png`;
const LOGO_W = 600;
const LOGO_H = 141;

const hasTz = (iso: string) => /Z$|[+-]\d{2}:?\d{2}$/.test(iso);

/**
 * WordPress datetimes carry no zone: `*_gmt` fields are UTC, the others are
 * Bangkok wall time. Returns a UTC ISO string ("…Z"), or undefined.
 */
export function toUtcIso(iso: string | null | undefined, isGmt = true): string | undefined {
  if (!iso) return undefined;
  const d = new Date(hasTz(iso) ? iso : `${iso}${isGmt ? "Z" : "+07:00"}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().replace(/\.000Z$/, "Z");
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE_NAME,
    alternateName: "ไบรท์ทีวี",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: LOGO_URL,
      width: LOGO_W,
      height: LOGO_H,
    },
    sameAs: [
      "https://www.facebook.com/BrightTVOfficialMedia",
      "https://x.com/BrightTVth",
      "https://www.youtube.com/brighttv20",
      "https://www.instagram.com/brighttv",
      "https://www.tiktok.com/@brighttv",
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "th-TH",
    publisher: organizationSchema(),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url.startsWith("http") ? it.url : `${SITE_URL}${it.url}`,
    })),
  };
}

export function newsArticleSchema(args: {
  url: string;
  headline: string;
  description: string;
  imageUrl?: string;
  /** Several crops of the lead image (Google wants 16:9, 4:3 and 1:1). Wins over `imageUrl`. */
  images?: string[];
  /** ISO datetime. Accepts WP's naked site-local (`2026-04-09T10:31:17`) or
   *  WP's `date_gmt` (same shape, UTC). A `Z` suffix is added when missing
   *  so Google's Rich Results validator doesn't warn about ambiguous tz. */
  datePublished: string;
  dateModified?: string;
  /** Whether `datePublished` / `dateModified` are GMT values (preferred,
   *  from `post.date_gmt`). When true we append `Z`; otherwise we append
   *  Thailand's `+07:00` offset. */
  datesAreGmt?: boolean;
  authorName: string;
  authorUrl?: string;
  categoryName?: string;
  keywords?: string[];
}) {
  const fullUrl = args.url.startsWith("http") ? args.url : `${SITE_URL}${args.url}`;
  const tz = args.datesAreGmt ? "Z" : "+07:00";
  const normaliseDate = (iso: string | undefined): string | undefined => {
    if (!iso) return undefined;
    // Already has a timezone marker (Z or ±HH:MM) — pass through.
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(iso)) return iso;
    return `${iso}${tz}`;
  };

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": fullUrl,
    },
    headline: args.headline,
    description: args.description,
    image: args.images?.length ? args.images : args.imageUrl ? [args.imageUrl] : undefined,
    isAccessibleForFree: true,
    datePublished: normaliseDate(args.datePublished),
    dateModified: normaliseDate(args.dateModified) || normaliseDate(args.datePublished),
    author: {
      "@type": "Person",
      name: args.authorName,
      // Fall back to the site origin so Google never sees `url` as missing —
      // a non-empty URL satisfies the recommended-properties check even when
      // the author has no dedicated WP archive page.
      url: args.authorUrl || SITE_URL,
    },
    publisher: organizationSchema(),
    articleSection: args.categoryName,
    keywords: args.keywords?.join(", "),
    inLanguage: "th-TH",
  };
}

// VideoObject schema for articles with an embedded YouTube video. Google
// uses this to show video rich results in search.
export function videoObjectSchema(args: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  contentUrl?: string;
  embedUrl: string;
  datesAreGmt?: boolean;
}) {
  const tz = args.datesAreGmt ? "Z" : "+07:00";
  const uploadDate = /Z$|[+-]\d{2}:?\d{2}$/.test(args.uploadDate)
    ? args.uploadDate
    : `${args.uploadDate}${tz}`;
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: args.name,
    description: args.description,
    thumbnailUrl: args.thumbnailUrl,
    uploadDate,
    // contentUrl must be the media file itself: a YouTube watch page isn't one
    // (Google flags it), so YouTube videos carry embedUrl only.
    contentUrl:
      args.contentUrl && !/(?:youtube\.com|youtu\.be)\//i.test(args.contentUrl) ? args.contentUrl : undefined,
    embedUrl: args.embedUrl,
  };
}

/** Static page (about-us, contact-us, privacy-policy …): WebPage, or AboutPage / ContactPage. */
export function webPageSchema(args: {
  url: string;
  name: string;
  description?: string;
  type?: "WebPage" | "AboutPage" | "ContactPage";
  dateModified?: string;
}) {
  const fullUrl = args.url.startsWith("http") ? args.url : `${SITE_URL}${args.url}`;
  return {
    "@context": "https://schema.org",
    "@type": args.type ?? "WebPage",
    "@id": fullUrl,
    url: fullUrl,
    name: args.name,
    description: args.description || undefined,
    dateModified: args.dateModified,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    publisher: organizationSchema(),
    inLanguage: "th-TH",
  };
}

export function collectionPageSchema(args: {
  url: string;
  name: string;
  description?: string;
  items?: Array<{ url: string; headline: string; imageUrl?: string }>;
}) {
  const fullUrl = args.url.startsWith("http") ? args.url : `${SITE_URL}${args.url}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": fullUrl,
    url: fullUrl,
    name: args.name,
    description: args.description,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: organizationSchema(),
    inLanguage: "th-TH",
    mainEntity: args.items
      ? {
          "@type": "ItemList",
          itemListElement: args.items.map((it, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: it.url.startsWith("http") ? it.url : `${SITE_URL}${it.url}`,
            name: it.headline,
            image: it.imageUrl,
          })),
        }
      : undefined,
  };
}

