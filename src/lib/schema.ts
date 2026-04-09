// JSON-LD schema generators for SEO.
// All schemas reference https://schema.org and are rendered as <script type="application/ld+json">.
import { SITE_ORIGIN } from "./env";

const SITE_URL = SITE_ORIGIN;
const SITE_NAME = "BRIGHT TV";
const LOGO_URL = `${SITE_URL}/logo.svg`;

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
      width: 260,
      height: 60,
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
    image: args.imageUrl ? [args.imageUrl] : undefined,
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

