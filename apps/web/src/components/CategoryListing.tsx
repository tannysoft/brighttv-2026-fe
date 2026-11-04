// Category listing, rendered at the category's own path (/news/politics,
// /entertain, …) by app/[...slug], and the all-stories "latest news" list at
// /news. Old /category/... URLs redirect here (next.config.ts).
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getPostsWindow, type WPCategory } from "@/lib/wp";
import { listingWindow, stripHtml } from "@/lib/utils";
import { categoryFeedPath, categoryPath, findNavBySlug, pagePath } from "@/lib/categories";
import { getPostPath } from "@/lib/utils";
import { SITE_ORIGIN } from "@/lib/env";
import ArticleCard from "@/components/ArticleCard";
import HeroSideGrid from "@/components/HeroSideGrid";
import SectionTitle from "@/components/SectionTitle";
import JsonLd from "@/components/JsonLd";
import { DEFAULT_OG_IMAGE, SITE_NAME, breadcrumbSchema, collectionPageSchema } from "@/lib/schema";

/** What a listing shows: one category, or every story ("latest"). */
export type ListingSource =
  | { kind: "category"; slug: string; wp: WPCategory }
  | { kind: "latest" };

export const LATEST_PATH = "/news";
const LATEST = {
  name: "ข่าวล่าสุด",
  h1: "ข่าวล่าสุดวันนี้",
  title: "ข่าววันนี้ ข่าวล่าสุด ข่าวด่วน อัปเดตตลอด 24 ชั่วโมง",
  description:
    "ข่าววันนี้ ข่าวล่าสุด ข่าวด่วน ข่าวเด่นทุกหมวด การเมือง สังคม อาชญากรรม เศรษฐกิจ บันเทิง ต่างประเทศ และกีฬา อัปเดตตลอด 24 ชั่วโมงจาก BRIGHT TV",
};

/** A category by slug, or null when WordPress/CMS doesn't have it. */
export async function loadCategory(slug: string): Promise<ListingSource | null> {
  const wp = await getCategoryBySlug(slug);
  return wp ? { kind: "category", slug: wp.slug || slug, wp } : null;
}

function describe(src: ListingSource) {
  if (src.kind === "latest") return { ...LATEST, path: LATEST_PATH };
  const name = findNavBySlug(src.slug)?.name || stripHtml(src.wp.name) || "หมวดหมู่ข่าว";
  // 150+ chars so Google shows our snippet instead of making one up.
  const description =
    stripHtml(src.wp.description) ||
    `รวมข่าว${name}ล่าสุดจาก BRIGHT TV เกาะติดทุกสถานการณ์ อัปเดตทุกความเคลื่อนไหวข่าว${name} ที่คนไทยให้ความสนใจ ครบจบในที่เดียว`;
  // "ข่าวพระราชสำนัก" → not "ข่าวข่าวพระราชสำนัก…"
  const news = name.startsWith("ข่าว") ? name : `ข่าว${name}`;
  return { name, h1: name, title: `${news}ล่าสุด วันนี้`, description, path: categoryPath(src.slug) };
}

export function listingMetadata(src: ListingSource, page: number): Metadata {
  const d = describe(src);
  const url = pagePath(d.path, page);
  return {
    title: page > 1 ? `${d.title} หน้า ${page}` : d.title,
    description: d.description,
    alternates: {
      canonical: url,
      types: { "application/rss+xml": src.kind === "latest" ? "/feed" : categoryFeedPath(src.slug) },
    },
    openGraph: { url, title: d.title, description: d.description, type: "website", siteName: SITE_NAME, locale: "th_TH", images: [DEFAULT_OG_IMAGE] },
  };
}

export default async function CategoryListing({ src, page }: { src: ListingSource; page: number }) {
  const d = describe(src);
  // Page 1: 1 hero + 4 side + 12 grid = 17; page 2+: 12 grid only (by offset,
  // so page 2 starts right after page 1's 17 stories).
  const win = listingWindow(page, 17, 12);
  const { posts, total } = await getPostsWindow({
    ...(src.kind === "category" ? { categories: src.wp.id } : {}),
    offset: win.offset,
    limit: win.limit,
  });
  const totalPages = win.totalPages(total);
  if (!posts.length || page > totalPages) notFound();

  const acfHeading2 = src.kind === "category" ? (src.wp.acf?.heading_2 ?? "") : "";
  const acfContents = src.kind === "category" ? (src.wp.acf?.contents ?? "") : "";
  const [lead, ...rest] = posts;
  const hasNext = page < totalPages;
  const pageHref = (n: number) => pagePath(d.path, n);
  const underNews = src.kind === "category" && d.path.startsWith(`${LATEST_PATH}/`);

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8">
      <JsonLd
        data={[
          collectionPageSchema({ url: pageHref(page), name: d.name, description: d.description }),
          // The stories on this page, in order (helps Google read it as a news list).
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: posts.map((p, i) => ({
              "@type": "ListItem",
              position: win.offset + i + 1,
              url: `${SITE_ORIGIN}${getPostPath(p)}`,
            })),
          },
          breadcrumbSchema([
            { name: "หน้าแรก", url: "/" },
            ...(underNews ? [{ name: LATEST.name, url: LATEST_PATH }] : []),
            { name: d.name, url: d.path },
          ]),
        ]}
      />
      <nav className="text-xs text-[var(--bt-muted)] mb-4 flex items-center gap-2 whitespace-nowrap overflow-hidden">
        <Link href="/" className="shrink-0 hover:text-[var(--bt-red)]">หน้าแรก</Link>
        <span className="shrink-0">›</span>
        {underNews && (
          <>
            <Link href={LATEST_PATH} className="shrink-0 hover:text-[var(--bt-red)]">{LATEST.name}</Link>
            <span className="shrink-0">›</span>
          </>
        )}
        <span className="text-[var(--bt-navy)] font-semibold truncate min-w-0">{d.name}</span>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--bt-navy)] mb-2">
        {d.h1}
        {page > 1 && <span className="text-[var(--bt-muted)] text-xl sm:text-2xl font-bold"> · หน้า {page}</span>}
      </h1>
      <p className="text-sm text-[var(--bt-muted)] mb-8">{d.description}</p>

      {page === 1 && lead && (
        <section className="grid gap-6 lg:grid-cols-3 mb-12">
          <div className="lg:col-span-2">
            <ArticleCard post={lead} variant="hero" priority />
          </div>
          <HeroSideGrid posts={rest.slice(0, 4)} />
        </section>
      )}

      <SectionTitle title={src.kind === "latest" ? "ข่าวทั้งหมด" : `${d.name}ทั้งหมด`} />
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        {(page === 1 ? rest.slice(4) : posts).map((p) => (
          <ArticleCard key={p.id} post={p} variant="feature" />
        ))}
      </div>

      <div className="flex justify-center gap-3 mt-10">
        {page > 1 && (
          <Link
            href={pageHref(page - 1)}
            className="h-10 px-5 rounded-full bg-white border border-[var(--bt-line)] inline-flex items-center text-sm font-semibold text-[var(--bt-navy)] hover:border-[var(--bt-navy)]"
          >
            ‹ ก่อนหน้า
          </Link>
        )}
        {hasNext && (
          <Link
            href={pageHref(page + 1)}
            className="h-10 px-5 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white inline-flex items-center text-sm font-bold transition-colors"
          >
            ถัดไป ›
          </Link>
        )}
      </div>

      {/* WordPress category ACF content: heading_2 + contents (HTML) */}
      {(acfHeading2 || acfContents) && page === 1 && (
        <section className="mt-14 pt-10 border-t border-[var(--bt-line)]">
          {acfHeading2 && (
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--bt-navy)] mb-4">{acfHeading2}</h2>
          )}
          {acfContents && (
            <div
              className="article-body prose prose-sm max-w-none text-[var(--bt-text)] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: acfContents }}
            />
          )}
        </section>
      )}
    </div>
  );
}
