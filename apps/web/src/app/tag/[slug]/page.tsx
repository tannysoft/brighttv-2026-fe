import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPosts } from "@/lib/wp";
import ArticleCard from "@/components/ArticleCard";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema";

export const revalidate = 300;

type Params = { slug: string };

// Decode percent-encoded Thai slugs for display.
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = safeDecode(slug);
  return {
    title: `แท็ก: ${name}`,
    description: `รวมข่าวทั้งหมดที่ติดแท็ก ${name} จาก BRIGHT TV อัปเดตข่าวล่าสุดครบทุกประเด็น`,
    alternates: { canonical: `/tag/${slug}` },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || "1"));
  const name = safeDecode(slug);

  // Single API call — contents/v1 supports `tag_slug` directly, so we
  // don't need a separate tag-lookup call anymore. Posts come back with
  // featured_image, author_info, taxonomies inline (no _embed needed).
  const perPage = 16;
  const posts = await getPosts({ tagSlug: slug, perPage, page });
  if (!posts.length && page === 1) notFound();

  const hasNext = posts.length === perPage;

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8">
      <JsonLd
        data={[
          collectionPageSchema({
            url: `/tag/${slug}`,
            name,
            description: `รวมข่าวที่ติดแท็ก ${name}`,
          }),
          breadcrumbSchema([
            { name: "หน้าแรก", url: "/" },
            { name: `แท็ก: ${name}`, url: `/tag/${slug}` },
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
        {page > 1 && (
          <Link
            href={`/tag/${slug}?page=${page - 1}`}
            className="h-10 px-5 rounded-full bg-white border border-[var(--bt-line)] inline-flex items-center text-sm font-semibold text-[var(--bt-navy)] hover:border-[var(--bt-navy)]"
          >
            ‹ ก่อนหน้า
          </Link>
        )}
        {hasNext && (
          <Link
            href={`/tag/${slug}?page=${page + 1}`}
            className="h-10 px-5 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white inline-flex items-center text-sm font-bold transition-colors"
          >
            ถัดไป ›
          </Link>
        )}
      </div>
    </div>
  );
}
