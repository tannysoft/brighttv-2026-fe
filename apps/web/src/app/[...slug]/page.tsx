import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getArticleSidebar, getMediaSizes, getPostBySlug } from "@/lib/wp";
import { SITE_NOINDEX, SITE_ORIGIN, WP_API_ORIGIN } from "@/lib/env";
import {
  DEFAULT_FEATURED_IMAGE,
  metaDescription,
  getAuthorName,
  getAuthorUrl,
  getFeaturedImage,
  getPostPath,
  getPrimaryCategory,
  getYoutubeId,
  sidebarPostToWPPost,
  stripHtml,
  thaiDate,
} from "@/lib/utils";
import ArticleBody from "@/components/ArticleBody";
import ViewBeacon from "@/components/ViewBeacon";
import ArticleCard from "@/components/ArticleCard";
import ArticleGallery from "@/components/ArticleGallery";
import CopyLinkButton from "@/components/CopyLinkButton";
import SectionTitle from "@/components/SectionTitle";
import JsonLd from "@/components/JsonLd";
import RankedItem from "@/components/RankedItem";
import StickyBottomAside from "@/components/StickyBottomAside";
import TopKeywordsWidget from "@/components/TopKeywordsWidget";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  TWITTER_SITE,
  breadcrumbSchema,
  newsArticleSchema,
  toUtcIso,
  videoObjectSchema,
  webPageSchema,
} from "@/lib/schema";
import { CATEGORY_PARENT, categoryFromSegments, categoryPath, pagePath, splitPage } from "@/lib/categories";
import { parsePageParam } from "@/lib/utils";
import CategoryListing, { LATEST_PATH, listingMetadata, loadCategory, type ListingSource } from "@/components/CategoryListing";

export const revalidate = 600;

type Params = { slug: string[] };
type Search = { page?: string | string[] };

const decodeSeg = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * Category pages share this route with articles: /news/politics (known
 * sub-category at its exact path), /{top-level category}, and their pages
 * /…/page/N (also /news/page/N, the latest-news list). A sub-category slug
 * on its own (/politics), a category away from its path (/entertain →
 * /news/entertain), /page/1 and the old ?page=N all redirect. Anything else
 * is an article or static page (null).
 */
type Listing = { src: ListingSource; page: number } | { redirect: string };
async function resolveListing(segments: string[], queryPage: string | string[] | undefined): Promise<Listing | null> {
  const { base, page, paged } = splitPage(segments);
  let src: ListingSource | null = null;
  if (base.length === 1 && decodeSeg(base[0]) === "news") {
    src = { kind: "latest" };
  } else {
    const sub = categoryFromSegments(base);
    if (sub) src = await loadCategory(sub);
    else if (base.length === 1) {
      const leaf = decodeSeg(base[0]);
      if (CATEGORY_PARENT[leaf]) return { redirect: pagePath(categoryPath(leaf), page ?? 1) };
      src = await loadCategory(base[0]);
      if (src?.kind === "category" && decodeSeg(categoryPath(src.slug)) !== `/${leaf}`) {
        return { redirect: pagePath(categoryPath(src.slug), page ?? 1) };
      }
    }
  }
  if (!src) return null;
  const path = src.kind === "latest" ? LATEST_PATH : categoryPath(src.slug);
  if (paged && page === null) return { redirect: path };
  if (!paged && queryPage !== undefined) return { redirect: pagePath(path, parsePageParam(queryPage) ?? 1) };
  return { src, page: page ?? 1 };
}

/** Link to a post's category page. */
function categoryHref(cat: { slug: string; link?: string }): string {
  return cat.link?.startsWith("/") ? cat.link : categoryPath(cat.slug);
}

// Extract the WP post slug from a possibly nested URL like
// /news/politics/evaluation-results-policy → "evaluation-results-policy"
function pickSlug(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) return "";
  return segments[segments.length - 1];
}

// Return `n` unique items picked at random from `arr` without mutating the
// source. When `arr.length <= n` we just return a copy of everything so the
// caller never gets fewer items than asked for when the source is small.
function pickRandom<T>(arr: readonly T[], n: number): T[] {
  if (arr.length <= n) return arr.slice();
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await resolveListing(slug, (await searchParams).page);
  if (listing && !("redirect" in listing)) return listingMetadata(listing.src, listing.page);
  const post = await getPostBySlug(pickSlug(slug), slug[0]);
  if (!post) return { title: "ไม่พบบทความ", alternates: { canonical: null } };
  return articleMetadata(post);
}

type Post = NonNullable<Awaited<ReturnType<typeof getPostBySlug>>>;

// Titles longer than this drop the " | BRIGHT TV" suffix (Google cuts ~60 chars).
const LONG_TITLE = 55;

/** Plain-text description: Yoast/CMS value, else the excerpt, else the opening text of the body. */
function postDescription(post: Post): string {
  return (
    metaDescription(post._seo?.description) ||
    metaDescription(post.excerpt?.rendered) ||
    metaDescription(bodyText(post.content?.rendered))
  );
}

/** Body text without embeds/scripts/captions, for a fallback description. */
function bodyText(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<(script|style|figure|blockquote|iframe|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/https?:\/\/\S+/g, " ");
}

/**
 * Canonical path: the Yoast/CMS canonical when it points somewhere else,
 * otherwise the post's own path. Our own hosts (and WordPress's) become
 * paths so metadataBase (SITE_ORIGIN) applies.
 */
function canonicalFor(post: Post): string {
  const own = getPostPath(post);
  const c = post._seo?.canonical;
  if (!c) return own;
  try {
    const u = new URL(c, SITE_ORIGIN);
    const ours = new Set([new URL(SITE_ORIGIN).host, new URL(WP_API_ORIGIN).host, "www.brighttv.co.th", "brighttv.co.th"]);
    if (!ours.has(u.host)) return u.toString();
    const p = u.pathname.replace(/\/$/, "") || "/";
    return safeDecode(p) === safeDecode(own) ? own : p;
  } catch {
    return own;
  }
}

/** og:image / twitter:image: the featured image, else the Yoast social image. */
function shareImage(post: Post): { url: string; width?: number; height?: number; alt?: string } | null {
  const img = getFeaturedImage(post, "full");
  if (img && img.url !== DEFAULT_FEATURED_IMAGE.url) return img;
  if (post._seo?.ogImage) return { url: post._seo.ogImage };
  return null;
}

/**
 * Schema.org image list: the lead image in each distinct aspect ratio WP
 * has (16:9 first), each ≥ 50k pixels as Google requires.
 */
function schemaImages(post: Post): string[] {
  const sizes = Object.values(post.featured_image?.sizes ?? {}).filter(
    (s): s is NonNullable<typeof s> => Boolean(s?.src && s.width && s.height && s.width * s.height >= 50_000),
  );
  // Buckets: wide (16:9-ish), 4:3-ish, square, tall — one image each.
  const bucket = (r: number) => (r >= 1.5 ? "wide" : r >= 1.15 ? "4:3" : r >= 0.85 ? "1:1" : "tall");
  const byRatio = new Map<string, { src: string; px: number }>();
  for (const s of sizes) {
    const key = bucket(s.width / s.height);
    const px = s.width * s.height;
    if ((byRatio.get(key)?.px ?? 0) < px) byRatio.set(key, { src: s.src, px });
  }
  const list = [...byRatio.values()].sort((a, b) => b.px - a.px).map((s) => s.src);
  if (list.length) return list;
  const img = shareImage(post);
  return img ? [img.url] : [];
}

function articleMetadata(post: Post): Metadata {
  const seo = post._seo;
  const isPage = post.type === "page";
  const headline = seo?.title || stripHtml(post.title.rendered);
  const description = postDescription(post);
  const canonical = canonicalFor(post);
  const img = shareImage(post);
  const index = !SITE_NOINDEX && !seo?.noindex;
  const follow = !SITE_NOINDEX && !seo?.nofollow;
  const cat = isPage ? null : getPrimaryCategory(post);
  const tags = post.taxonomies?.tags?.map((t) => t.name).filter(Boolean) ?? [];
  const images = img ? [{ url: img.url, width: img.width, height: img.height, alt: img.alt || headline }] : [DEFAULT_OG_IMAGE];
  const common = {
    url: canonical,
    title: headline,
    description,
    siteName: SITE_NAME,
    locale: "th_TH",
    images,
  };
  return {
    title: headline.length > LONG_TITLE ? { absolute: headline } : headline,
    description,
    alternates: { canonical, types: { "application/rss+xml": "/feed" } },
    robots: index
      ? { index, follow, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 }
      : { index, follow },
    openGraph: isPage
      ? { ...common, type: "website" }
      : {
          ...common,
          type: "article",
          publishedTime: toUtcIso(post.date_gmt || post.date, Boolean(post.date_gmt)),
          modifiedTime: toUtcIso(post.modified_gmt || post.modified, Boolean(post.modified_gmt)),
          section: cat?.name,
          tags: tags.length ? tags : undefined,
        },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_SITE,
      title: headline,
      description,
      images: [images[0].url],
    },
  };
}

// Light pre-processing of WP HTML before it's handed to ArticleBody.
//
// WordPress's REST API returns `content.rendered` for Gutenberg oEmbed blocks
// as a wrapper `<figure class="wp-block-embed-<provider>">` containing just
// the raw URL — the actual conversion to an iframe/blockquote only happens
// on the WP front-end via render filters. Here we replicate that conversion
// for the providers Bright uses (TikTok, YouTube, Twitter/X, Instagram,
// Facebook) so ArticleBody can re-execute the provider SDKs and light them
// up client-side.
function processContent(html: string, mediaSizes: MediaSizes = {}): string {
  return processImages(convertOEmbedBlocks(html), mediaSizes);
}

type MediaSizes = Record<number, { width: number; height: number }>;

/** Attachment ids of `<img class="wp-image-ID">` tags that have no width/height. */
function unsizedImageIds(html: string): number[] {
  const ids: number[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    if (/\swidth\s*=/i.test(m[0]) && /\sheight\s*=/i.test(m[0])) continue;
    const id = Number(m[0].match(/wp-image-(\d+)/)?.[1]);
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * Body images: width/height (against layout shift) from the attachment
 * sizes or a "-WxH" file name, lazy loading + async decoding for all but the
 * first, `sizes` when there's a srcset, and an alt attribute on every one.
 */
function processImages(html: string, mediaSizes: MediaSizes): string {
  let n = 0;
  return html.replace(/<img\b([^>]*?)\s*\/?>/gi, (_tag, raw: string) => {
    n++;
    let attrs = raw;
    const has = (name: string) => new RegExp(`\\s${name}\\s*=`, "i").test(attrs);
    if (!has("width") || !has("height")) {
      const id = Number(attrs.match(/wp-image-(\d+)/)?.[1]);
      let dim = id ? mediaSizes[id] : undefined;
      if (!dim) {
        const src = attrs.match(/\ssrc\s*=\s*["']([^"']+)/i)?.[1];
        const m = src?.match(/-(\d{2,5})x(\d{2,5})\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i);
        if (m) dim = { width: Number(m[1]), height: Number(m[2]) };
      }
      if (dim) {
        attrs = attrs.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
        attrs += ` width="${dim.width}" height="${dim.height}"`;
      }
    }
    if (!has("alt")) attrs += ' alt=""';
    if (n > 1 && !has("loading")) attrs += ' loading="lazy"';
    if (n > 1 && !has("decoding")) attrs += ' decoding="async"';
    if (has("srcset") && !has("sizes")) attrs += ' sizes="(max-width: 1024px) 100vw, 800px"';
    return `<img${attrs} />`;
  });
}

// Replace `<figure class="wp-block-embed-*"><div class="wp-block-embed__wrapper">URL</div></figure>`
// blocks with each provider's real embed markup. Leaves unknown providers
// alone (so a plain URL is still rendered, just not converted).
function convertOEmbedBlocks(html: string): string {
  const wrapper =
    /<figure[^>]*wp-block-embed[^>]*is-provider-([a-z-]+)[^>]*>\s*<div[^>]*wp-block-embed__wrapper[^>]*>\s*([\s\S]*?)\s*<\/div>\s*<\/figure>/gi;

  return html.replace(wrapper, (match, provider: string, body: string) => {
    // The body usually has whitespace around a single URL. Some variants
    // also wrap the URL in an <a> tag. Extract the first URL we find.
    const urlMatch = body.match(/https?:\/\/[^\s"<]+/);
    if (!urlMatch) return match;
    const url = urlMatch[0].replace(/&amp;/g, "&");

    switch (provider) {
      case "tiktok": {
        const idMatch = url.match(/\/video\/(\d+)/);
        if (!idMatch) return match;
        const videoId = idMatch[1];
        const cleanUrl = url.split("?")[0];
        return (
          `<blockquote class="tiktok-embed" cite="${cleanUrl}" data-video-id="${videoId}" ` +
          `style="max-width:605px;min-width:325px;margin:1.5em auto;">` +
          `<section></section></blockquote>` +
          `<script async src="https://www.tiktok.com/embed.js"></script>`
        );
      }
      case "youtube": {
        const idMatch = url.match(
          /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/,
        );
        if (!idMatch) return match;
        const videoId = idMatch[1];
        return (
          `<figure class="wp-block-embed is-type-video is-provider-youtube my-6">` +
          `<div class="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-black">` +
          `<iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video" ` +
          `loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ` +
          `referrerpolicy="strict-origin-when-cross-origin" allowfullscreen ` +
          `class="absolute inset-0 w-full h-full"></iframe></div></figure>`
        );
      }
      case "twitter":
      case "x": {
        return (
          `<blockquote class="twitter-tweet"><a href="${url}"></a></blockquote>` +
          `<script async src="https://platform.twitter.com/widgets.js"></script>`
        );
      }
      case "instagram": {
        return (
          `<blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14" ` +
          `style="background:#FFF;border:0;border-radius:3px;box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15);margin:1.5em auto;max-width:540px;min-width:326px;padding:0;width:calc(100% - 2px);"></blockquote>` +
          `<script async src="https://www.instagram.com/embed.js"></script>`
        );
      }
      case "facebook": {
        return (
          `<div class="fb-post" data-href="${url}" data-width="550" data-show-text="true"></div>` +
          `<script async crossorigin="anonymous" ` +
          `src="https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0"></script>`
        );
      }
      default:
        return match;
    }
  });
}

// If the article body uses Facebook embeds, the FB SDK needs this anchor
// element somewhere in the document to mount its rendered iframes.
function needsFbRoot(rawHtml: string): boolean {
  return /fb-(post|video|page)|facebook\.com\/plugins\/|connect\.facebook\.net|is-provider-facebook/i.test(rawHtml);
}

export default async function ArticlePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await params;
  const listing = await resolveListing(slug, (await searchParams).page);
  if (listing) {
    if ("redirect" in listing) permanentRedirect(listing.redirect);
    return <CategoryListing src={listing.src} page={listing.page} />;
  }
  const post = await getPostBySlug(pickSlug(slug), slug[0]);
  if (!post) notFound();

  // Only the last segment picks the story, so /anything/else/{slug} would
  // render it too: send those to the story's real path. Compared decoded so
  // %E0 vs %e0 (WordPress uses lowercase) doesn't cause a redirect loop.
  // (/lottery/* is handled separately.)
  const articlePath = getPostPath(post);
  if (slug[0] !== "lottery" && safeDecode(articlePath) !== "/" + slug.map(safeDecode).join("/")) {
    permanentRedirect(articlePath);
  }

  const title = stripHtml(post.title.rendered);
  const img = getFeaturedImage(post, "full");
  const youtubeId = getYoutubeId(post);
  const cat = getPrimaryCategory(post);
  const author = getAuthorName(post);
  // Static pages (about-us, privacy-policy …) aren't news: WebPage schema, no news lists.
  const isPage = post.type === "page";
  const fbRoot = needsFbRoot(post.content.rendered);

  // Sidebar (related + mostview + latest) from Bright's custom endpoint. The
  // endpoint already excludes the current post and returns curated lists, so
  // we just map them through the WPPost adapter and slice to display sizes.
  const [sidebar, mediaSizes] = await Promise.all([
    isPage ? { related: [], latest: [], mostview: [] } : getArticleSidebar(post),
    getMediaSizes(unsizedImageIds(post.content.rendered)),
  ]);
  const html = processContent(post.content.rendered, mediaSizes);
  const publishedIso = toUtcIso(post.date_gmt || post.date, Boolean(post.date_gmt));
  const description = postDescription(post);
  const related = sidebar.related.slice(0, 4).map(sidebarPostToWPPost);
  const galleryRelated = sidebar.related.slice(0, 6).map(sidebarPostToWPPost);
  const mostview = sidebar.mostview.slice(0, 5).map(sidebarPostToWPPost);
  // Pick 4 random items out of the 10 "latest" from the sidebar so the
  // bottom row of the article varies between ISR revalidations and doesn't
  // show the same four posts forever. Shuffled server-side — the result is
  // frozen into the cached HTML until `revalidate` expires.
  const latest = pickRandom(sidebar.latest, 4).map(sidebarPostToWPPost);

  // (articlePath above: canonical path from WP's pathname, e.g. /social-news/indictment-…)

  // Prefer the GMT timestamps from WP so we can append a strict `Z` suffix
  // — Google's Rich Results validator flags naked site-local datetimes as
  // "missing timezone". Fall back to the naked site times with a Thailand
  // +07:00 offset when GMT isn't in the payload.
  const datesAreGmt = Boolean(post.date_gmt);
  // Pull tag names from the inline taxonomies (contents/v1) so the schema
  // includes keywords without an extra API call.
  const tagNames = post.taxonomies?.tags?.map((t) => t.name).filter(Boolean);

  const articleSchema = isPage
    ? webPageSchema({
        url: articlePath,
        name: title,
        description,
        type: /about/i.test(post.slug) ? "AboutPage" : /contact/i.test(post.slug) ? "ContactPage" : "WebPage",
        dateModified: toUtcIso(post.modified_gmt || post.modified, Boolean(post.modified_gmt)),
      })
    : newsArticleSchema({
    url: articlePath,
    headline: title,
    description,
    images: schemaImages(post),
    datePublished: post.date_gmt || post.date,
    dateModified: post.modified_gmt || post.modified,
    datesAreGmt,
    authorName: author,
    authorUrl: getAuthorUrl(post) || undefined,
    categoryName: cat?.name,
    keywords: tagNames?.length ? tagNames : undefined,
  });
  const crumbSchema = breadcrumbSchema([
    { name: "หน้าแรก", url: "/" },
    ...(cat ? [{ name: cat.name, url: categoryHref(cat) }] : []),
    { name: title, url: articlePath },
  ]);

  // VideoObject for Google Video rich results — only when article has YouTube.
  const videoSchema = youtubeId
    ? videoObjectSchema({
        name: title,
        description: description || title,
        thumbnailUrl:
          img && img.url !== DEFAULT_FEATURED_IMAGE.url
            ? img.url
            : `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
        uploadDate: post.date_gmt || post.date,
        embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
        datesAreGmt: datesAreGmt,
      })
    : null;

  const schemas = [articleSchema, crumbSchema, ...(videoSchema ? [videoSchema] : [])];

  return (
    <article className="mx-auto max-w-[1320px] px-4 py-8">
      <ViewBeacon id={post.id} />
      <JsonLd data={schemas} />
      <nav className="text-xs text-[var(--bt-muted)] mb-4 flex items-center gap-2 whitespace-nowrap overflow-hidden">
        <Link href="/" className="shrink-0 hover:text-[var(--bt-red)]">หน้าแรก</Link>
        <span className="shrink-0">›</span>
        {cat && (
          <>
            <Link href={categoryHref(cat)} className="shrink-0 hover:text-[var(--bt-red)]">
              {cat.name}
            </Link>
            <span className="shrink-0">›</span>
          </>
        )}
        <span className="text-[var(--bt-navy)] font-semibold truncate min-w-0">{title}</span>
      </nav>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          {cat && (
            <Link
              href={categoryHref(cat)}
              className="inline-block px-3 py-1 rounded-full bg-[var(--bt-red)] !text-white text-[11px] font-bold uppercase tracking-wider mb-4"
            >
              {cat.name}
            </Link>
          )}
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-snug text-[var(--bt-navy)]">
            {title}
          </h1>

          <div className="mt-4 flex items-center justify-between gap-4 text-xs text-[var(--bt-muted)] border-b border-[var(--bt-line)] pb-5 flex-wrap">
            <div className="flex items-center gap-3">
              {(() => {
                const authorSlug = post.author_info?.pathname || post._embedded?.author?.[0]?.slug;
                const authorHref = authorSlug
                  ? (authorSlug.startsWith("/") ? authorSlug : `/author/${authorSlug}`)
                  : null;
                const avatarEl = (
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bt-navy)] !text-white font-bold shrink-0">
                    {author.slice(0, 1)}
                  </span>
                );
                const nameEl = (
                  <div>
                    <div className="font-semibold text-[var(--bt-text)] hover:text-[var(--bt-red)] transition-colors">
                      {author}
                    </div>
                    <div>
                      เผยแพร่{" "}
                      <time dateTime={publishedIso}>{thaiDate(post.date, { withTime: true })}</time>
                    </div>
                  </div>
                );
                return authorHref ? (
                  <Link href={authorHref} className="flex items-center gap-3 group">
                    {avatarEl}
                    {nameEl}
                  </Link>
                ) : (
                  <>
                    {avatarEl}
                    {nameEl}
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <ShareIconLink
                href={`https://www.facebook.com/sharer/sharer.php?u=${SITE_ORIGIN}${articlePath}`}
                label="Facebook"
                color="#1877F2"
                icon="facebook"
              />
              <ShareIconLink
                href={`https://twitter.com/intent/tweet?url=${SITE_ORIGIN}${articlePath}&text=${encodeURIComponent(title)}`}
                label="X"
                color="#000"
                icon="x"
              />
              <ShareIconLink
                href={`https://line.me/R/msg/text/?${encodeURIComponent(title + " " + SITE_ORIGIN + articlePath)}`}
                label="LINE"
                color="#06C755"
                icon="line"
              />
              <CopyLinkButton
                url={`${SITE_ORIGIN}${articlePath}`}
                size="sm"
                tooltipSide="top"
              />
            </div>
          </div>

          {youtubeId ? (
            <figure className="my-6">
              <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  title={title}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </figure>
          ) : img ? (
            <figure className="my-6">
              <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-[var(--bt-navy-50)]">
                <Image
                  src={img.url}
                  alt={img.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 800px"
                  className="object-cover"
                  priority
                />
              </div>
              {img.alt && (
                <figcaption className="mt-2 text-center text-xs text-[var(--bt-muted)]">
                  {img.alt}
                </figcaption>
              )}
            </figure>
          ) : null}

          {/* Excerpt — summary text below the featured image/video */}
          {post.excerpt.rendered && (
            <p className="my-6 text-[15px] sm:text-[17px] leading-relaxed text-[var(--bt-muted)] font-medium">
              {stripHtml(post.excerpt.rendered)}
            </p>
          )}

          {/* ArticleBody is a client component that re-runs any <script> tags
              in the WP HTML so YouTube/oEmbed/Twitter/Instagram/TikTok/Facebook
              embeds and any other inline scripts actually execute. */}
          {fbRoot && <div id="fb-root" />}
          <ArticleBody html={html} />

          {/* Gallery — clickable thumbnails + full-screen lightbox */}
          {post.gallery_images && post.gallery_images.length > 0 && (
            <ArticleGallery
              images={post.gallery_images}
              articleTitle={title}
              articleUrl={`${SITE_ORIGIN}${articlePath}`}
              relatedPosts={galleryRelated.map((p) => ({
                id: p.id,
                title: stripHtml(p.title.rendered),
                href: getPostPath(p),
                thumbSrc: getFeaturedImage(p, "medium").url,
                date: p.date,
              }))}
            />
          )}

          {/* Tags — use taxonomies.tags from contents/v1 directly */}
          <PostTags tags={post.taxonomies?.tags} />
        </div>

        {/* Tall sidebar: let the user scroll through related + mostview first,
            then pin it so the bottom of the sidebar aligns with the viewport
            bottom. StickyBottomAside measures its own height on the client
            and sets the sticky `top` via a CSS var so the math stays right
            even as content changes. */}
        <StickyBottomAside className="lg:col-span-1 space-y-10">
          {related.length > 0 && (
            <section>
              <SectionTitle title="ข่าวที่เกี่ยวข้อง" accent="red" />
              <div className="space-y-4">
                {related.map((p) => (
                  <ArticleCard key={p.id} post={p} variant="compact" />
                ))}
              </div>
            </section>
          )}
          {mostview.length > 0 && (
            <section>
              <SectionTitle title="ข่าวยอดนิยม" accent="red" />
              <ol className="space-y-5">
                {mostview.map((p, i) => (
                  <RankedItem key={p.id} post={p} rank={i + 1} />
                ))}
              </ol>
            </section>
          )}
          {/* Trending-tag cloud — always last so the sticky calculation in
              StickyBottomAside measures the full sidebar height. */}
          <TopKeywordsWidget />
        </StickyBottomAside>
      </div>

      {latest.length > 0 && (
        <section className="mt-16">
          <SectionTitle title="ข่าวล่าสุด" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {latest.map((p) => (
              <ArticleCard key={p.id} post={p} variant="feature" />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

// Uses post.taxonomies.tags from contents/v1 — no separate API call needed.
function PostTags({
  tags,
}: {
  tags?: Array<{ id: number; name: string; slug?: string; nicename?: string }>;
}) {
  if (!tags?.length) return null;
  return (
    <div className="mt-8 pt-6 border-t border-[var(--bt-line)]">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--bt-red)] mb-3">
        แท็กที่เกี่ยวข้อง
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.slice(0, 12).map((t) => {
          const slug = t.slug || t.nicename || "";
          return (
            <Link
              key={t.id}
              href={`/tag/${safeDecode(slug)}`}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-[var(--bt-bg)] border border-[var(--bt-line)] text-[13px] font-semibold text-[var(--bt-navy)] hover:bg-[var(--bt-navy)] hover:!text-white hover:border-[var(--bt-navy)] transition-colors"
            >
              <span className="text-[var(--bt-red)]">#</span>
              {t.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function ShareIconLink({
  href,
  label,
  color,
  icon,
}: {
  href: string;
  label: string;
  color: string;
  icon: "facebook" | "x" | "line";
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`แชร์ไปที่ ${label}`}
      title={`แชร์ไปที่ ${label}`}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full !text-white hover:scale-110 transition-transform shadow-sm"
      style={{ background: color }}
    >
      <ShareIcon name={icon} />
    </a>
  );
}

function ShareIcon({ name }: { name: "facebook" | "x" | "line" }) {
  const props = { width: 16, height: 16, fill: "currentColor", className: "text-white" } as const;
  if (name === "facebook")
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.8c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5V12h2.6l-.4 2.9h-2.2v7A10 10 0 0 0 22 12" />
      </svg>
    );
  if (name === "x")
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M18.244 2H21l-6.522 7.45L22 22h-6.094l-4.77-6.231L5.7 22H3l7.013-8.01L2 2h6.245l4.31 5.696L18.244 2zm-1.07 18h1.687L7.01 4H5.198L17.174 20z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016a.63.63 0 0 1-.451.605.6.6 0 0 1-.182.027.63.63 0 0 1-.512-.257l-2.443-3.323v2.95a.63.63 0 0 1-.629.628.628.628 0 0 1-.626-.628V8.108a.63.63 0 0 1 .43-.598c.06-.022.137-.034.196-.034.197 0 .378.105.494.255l2.458 3.336v-2.96c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.772zm-5.741 0a.629.629 0 0 1-.626.628.626.626 0 0 1-.626-.628V8.108c0-.345.282-.63.63-.63.345 0 .622.285.622.63v4.771zm-2.466.628H4.917a.625.625 0 0 1-.625-.628V8.108c0-.345.282-.63.628-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.628-.629.628M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}
