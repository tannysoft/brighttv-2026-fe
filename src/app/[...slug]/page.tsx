import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getArticleSidebar,
  getPostBySlug,
  getFeaturedImage,
  getPostPath,
  getPrimaryCategory,
  getAuthorName,
  getYoutubeId,
  sidebarPostToWPPost,
  stripHtml,
  thaiDate,
} from "@/lib/wp";
import ArticleBody from "@/components/ArticleBody";
import ArticleCard from "@/components/ArticleCard";
import ArticleGallery from "@/components/ArticleGallery";
import SectionTitle from "@/components/SectionTitle";
import JsonLd from "@/components/JsonLd";
import RankedItem from "@/components/RankedItem";
import StickyBottomAside from "@/components/StickyBottomAside";
import { breadcrumbSchema, newsArticleSchema } from "@/lib/schema";

export const revalidate = 600;

type Params = { slug: string[] };

// Extract the WP post slug from a possibly nested URL like
// /news/politics/evaluation-results-policy → "evaluation-results-policy"
function pickSlug(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) return "";
  return segments[segments.length - 1];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(pickSlug(slug));
  if (!post) return { title: "ไม่พบบทความ" };
  const title = stripHtml(post.title.rendered);
  const description = stripHtml(post.excerpt.rendered).slice(0, 160);
  const img = getFeaturedImage(post, "full");
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: img ? [{ url: img.url, width: img.width, height: img.height }] : [],
    },
  };
}

// Light pre-processing of WP HTML before it's handed to ArticleBody. We
// preserve <script>, <style>, <iframe>, and embed markup; ArticleBody re-runs
// any inline scripts client-side so YouTube/oEmbed/social SDK embeds work.
function processContent(html: string): string {
  return html.replace(/loading="lazy"/g, 'loading="lazy" decoding="async"');
}

// If the article body uses Facebook embeds, the FB SDK needs this anchor
// element somewhere in the document to mount its rendered iframes.
function needsFbRoot(rawHtml: string): boolean {
  return /fb-(post|video|page)|facebook\.com\/plugins\/|connect\.facebook\.net/i.test(rawHtml);
}

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = await getPostBySlug(pickSlug(slug));
  if (!post) notFound();

  const title = stripHtml(post.title.rendered);
  const img = getFeaturedImage(post, "full");
  const youtubeId = getYoutubeId(post);
  const cat = getPrimaryCategory(post);
  const author = getAuthorName(post);
  const html = processContent(post.content.rendered);
  const fbRoot = needsFbRoot(post.content.rendered);

  // Sidebar (related + mostview + latest) from Bright's custom endpoint. The
  // endpoint already excludes the current post and returns curated lists, so
  // we just map them through the WPPost adapter and slice to display sizes.
  const sidebar = await getArticleSidebar(post.id);
  const related = sidebar.related.slice(0, 4).map(sidebarPostToWPPost);
  const galleryRelated = sidebar.related.slice(0, 6).map(sidebarPostToWPPost);
  const mostview = sidebar.mostview.slice(0, 5).map(sidebarPostToWPPost);
  const latest = sidebar.latest.slice(0, 4).map(sidebarPostToWPPost);

  // Canonical path from WP's nuxtlink (e.g. /social-news/indictment-…)
  const articlePath = getPostPath(post);

  const articleSchema = newsArticleSchema({
    url: articlePath,
    headline: title,
    description: stripHtml(post.excerpt.rendered).slice(0, 200),
    imageUrl: img?.url,
    datePublished: post.date,
    dateModified: post.modified,
    authorName: author,
    categoryName: cat?.name,
  });
  const crumbSchema = breadcrumbSchema([
    { name: "หน้าแรก", url: "/" },
    ...(cat ? [{ name: cat.name, url: `/category/${cat.slug}` }] : []),
    { name: title, url: articlePath },
  ]);

  return (
    <article className="mx-auto max-w-[1240px] px-4 py-8">
      <JsonLd data={[articleSchema, crumbSchema]} />
      <nav className="text-xs text-[var(--bt-muted)] mb-4 flex items-center gap-2 flex-wrap">
        <Link href="/" className="hover:text-[var(--bt-red)]">หน้าแรก</Link>
        <span>›</span>
        {cat && (
          <>
            <Link href={`/category/${cat.slug}`} className="hover:text-[var(--bt-red)]">
              {cat.name}
            </Link>
            <span>›</span>
          </>
        )}
        <span className="text-[var(--bt-navy)] font-semibold clamp-2">{title}</span>
      </nav>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          {cat && (
            <Link
              href={`/category/${cat.slug}`}
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
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bt-navy)] !text-white font-bold">
                {author.slice(0, 1)}
              </span>
              <div>
                <div className="font-semibold text-[var(--bt-text)]">{author}</div>
                <div>เผยแพร่ {thaiDate(post.date, { withTime: true })}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShareIconLink
                href={`https://www.facebook.com/sharer/sharer.php?u=https://www.brighttv.co.th${articlePath}`}
                label="Facebook"
                color="#1877F2"
                icon="facebook"
              />
              <ShareIconLink
                href={`https://twitter.com/intent/tweet?url=https://www.brighttv.co.th${articlePath}&text=${encodeURIComponent(title)}`}
                label="X"
                color="#000"
                icon="x"
              />
              <ShareIconLink
                href={`https://line.me/R/msg/text/?${encodeURIComponent(title + " https://www.brighttv.co.th" + articlePath)}`}
                label="LINE"
                color="#06C755"
                icon="line"
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
              articleUrl={`https://www.brighttv.co.th${articlePath}`}
              relatedPosts={galleryRelated.map((p) => ({
                id: p.id,
                title: stripHtml(p.title.rendered),
                href: getPostPath(p),
                thumbSrc: getFeaturedImage(p, "medium").url,
              }))}
            />
          )}

          {/* Tags */}
          <PostTags tagIds={post.tags} />
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

async function PostTags({ tagIds }: { tagIds: number[] }) {
  if (!tagIds?.length) return null;
  try {
    const ids = tagIds.slice(0, 12).join(",");
    const res = await fetch(
      `https://www.brighttv.co.th/wp-json/wp/v2/tags?include=${ids}&per_page=12`,
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return null;
    const tags = (await res.json()) as Array<{ id: number; name: string; slug: string }>;
    if (!tags.length) return null;
    return (
      <div className="mt-8 pt-6 border-t border-[var(--bt-line)]">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--bt-red)] mb-3">
          แท็กที่เกี่ยวข้อง
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Link
              key={t.id}
              href={`/tag/${t.slug}`}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-[var(--bt-bg)] border border-[var(--bt-line)] text-[13px] font-semibold text-[var(--bt-navy)] hover:bg-[var(--bt-navy)] hover:!text-white hover:border-[var(--bt-navy)] transition-colors"
            >
              <span className="text-[var(--bt-red)]">#</span>
              {t.name}
            </Link>
          ))}
        </div>
      </div>
    );
  } catch {
    return null;
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
