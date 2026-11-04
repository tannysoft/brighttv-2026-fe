// Tag listing, shared by /tag/{slug} and /tag/{slug}/page/{n}.
import { DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/schema";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostsWindow, getTagBySlug, type WPTag } from "@/lib/wp";
import { decodeEntities, listingWindow } from "@/lib/utils";
import { pagePath } from "@/lib/categories";
import ArticleCard from "@/components/ArticleCard";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema";
import { safeDecode, tagPath } from "./path";

export { tagPath };

const PER_PAGE = 16;

/**
 * The tag and the posts of `page`, or a 404 for an unknown tag, a tag with no
 * stories, or a page past the last one. Posts are queried by tag id, and must
 * carry the tag (WordPress' contents/v1 returns every post for an unmatched tag).
 */
async function load(slug: string, page: number) {
  const tag = await getTagBySlug(slug);
  if (!tag || !tag.count) notFound();
  const win = listingWindow(page, PER_PAGE, PER_PAGE);
  const { posts, total } = await getPostsWindow({ tags: tag.id, offset: win.offset, limit: win.limit });
  const totalPages = win.totalPages(total);
  if (!posts.length || page > totalPages || !posts.every((p) => p.tags?.includes(tag.id))) notFound();
  return { tag, posts, totalPages };
}

const tagName = (tag: WPTag | null, slug: string) => decodeEntities(tag?.name ?? "") || safeDecode(slug);

export async function tagMetadata(slug: string, page: number): Promise<Metadata> {
  const tag = await getTagBySlug(slug);
  const name = tagName(tag, slug);
  const url = pagePath(tagPath(slug), page);
  const title = `แท็ก: ${name}`;
  return {
    title: page > 1 ? `${title} หน้า ${page}` : title,
    description: `รวมข่าวทั้งหมดที่ติดแท็ก ${name} จาก BRIGHT TV อัปเดตข่าวล่าสุดครบทุกประเด็น`,
    alternates: {
      canonical: url,
      types: { "application/rss+xml": `${tagPath(slug)}/feed` },
    },
    openGraph: { url, title, type: "website", siteName: SITE_NAME, locale: "th_TH", images: [DEFAULT_OG_IMAGE] },
  };
}

export default async function TagListing({ slug, page }: { slug: string; page: number }) {
  const { tag, posts, totalPages } = await load(slug, page);
  const name = tagName(tag, slug);
  const base = tagPath(slug);
  const prev = page > 1 ? pagePath(base, page - 1) : null;
  const next = page < totalPages ? pagePath(base, page + 1) : null;

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8">
      {prev && <link rel="prev" href={prev} />}
      {next && <link rel="next" href={next} />}
      <JsonLd
        data={[
          collectionPageSchema({
            url: pagePath(base, page),
            name,
            description: `รวมข่าวที่ติดแท็ก ${name}`,
          }),
          breadcrumbSchema([
            { name: "หน้าแรก", url: "/" },
            { name: `แท็ก: ${name}`, url: base },
          ]),
        ]}
      />
      <nav className="text-xs text-[var(--bt-muted)] mb-4 flex items-center gap-2 whitespace-nowrap overflow-hidden">
        <Link href="/" className="shrink-0 hover:text-[var(--bt-red)]">หน้าแรก</Link>
        <span className="shrink-0">›</span>
        <span className="text-[var(--bt-navy)] font-semibold truncate min-w-0">
          แท็ก: {name}
        </span>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--bt-navy)] mb-2">
        {name}
        {page > 1 && <span className="text-[var(--bt-muted)] text-xl sm:text-2xl font-bold"> หน้า {page}</span>}
      </h1>
      <p className="text-sm text-[var(--bt-muted)] mb-8">
        รวมข่าวทั้งหมดที่ติดแท็ก {name}
      </p>

      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        {posts.map((p) => (
          <ArticleCard key={p.id} post={p} variant="feature" />
        ))}
      </div>

      <div className="flex justify-center gap-3 mt-10">
        {prev && (
          <Link
            href={prev}
            rel="prev"
            className="h-10 px-5 rounded-full bg-white border border-[var(--bt-line)] inline-flex items-center text-sm font-semibold text-[var(--bt-navy)] hover:border-[var(--bt-navy)]"
          >
            ‹ ก่อนหน้า
          </Link>
        )}
        {next && (
          <Link
            href={next}
            rel="next"
            className="h-10 px-5 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white inline-flex items-center text-sm font-bold transition-colors"
          >
            ถัดไป ›
          </Link>
        )}
      </div>
    </div>
  );
}
