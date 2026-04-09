import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategoryBySlug, getPosts } from "@/lib/wp";
import { stripHtml } from "@/lib/utils";
import { findNavBySlug } from "@/lib/categories";
import ArticleCard from "@/components/ArticleCard";
import HeroSideGrid from "@/components/HeroSideGrid";
import SectionTitle from "@/components/SectionTitle";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema";
import type { Metadata } from "next";

export const revalidate = 300;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const nav = findNavBySlug(slug);
  const cat = nav ? null : await getCategoryBySlug(slug);
  const name = nav?.name || cat?.name || "หมวดหมู่ข่าว";
  return {
    title: `${name} — ข่าว${name}ล่าสุด`,
    description: `รวมข่าว${name}ล่าสุดจาก BRIGHT TV ติดตามทุกความเคลื่อนไหว ที่คนไทยให้ความสนใจ`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || "1"));

  const nav = findNavBySlug(slug);
  // Always fetch the WP category so we can use its description. When we
  // already know the id from the local nav map we can do it in parallel
  // with the posts fetch; otherwise we need the id first, then the posts.
  const perPage = page === 1 ? 17 : 12;
  let categoryId: number | undefined = nav?.id;
  let categoryName: string | undefined = nav?.name;
  let wpDescription = "";
  let posts;

  if (nav) {
    const [wpCat, fetched] = await Promise.all([
      getCategoryBySlug(slug),
      getPosts({ categories: nav.id, perPage, page }),
    ]);
    if (wpCat?.description) wpDescription = wpCat.description;
    posts = fetched;
  } else {
    const wpCat = await getCategoryBySlug(slug);
    if (!wpCat) notFound();
    categoryId = wpCat.id;
    categoryName = wpCat.name;
    wpDescription = wpCat.description ?? "";
    posts = await getPosts({ categories: wpCat.id, perPage, page });
  }

  if (!posts.length && page === 1) notFound();

  // WP category description can contain HTML — strip tags before rendering.
  // Fall back to the generic template when the category has no description.
  const description =
    stripHtml(wpDescription) ||
    `รวมข่าว${categoryName}ล่าสุด อัปเดตทุกความเคลื่อนไหว`;

  const [lead, ...rest] = posts;
  const hasNext = posts.length === perPage;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8">
      <JsonLd
        data={[
          collectionPageSchema({
            url: `/category/${slug}`,
            name: categoryName || "หมวดหมู่",
            description,
          }),
          breadcrumbSchema([
            { name: "หน้าแรก", url: "/" },
            { name: categoryName || "หมวดหมู่", url: `/category/${slug}` },
          ]),
        ]}
      />
      <nav className="text-xs text-[var(--bt-muted)] mb-4 flex items-center gap-2 whitespace-nowrap overflow-hidden">
        <Link href="/" className="shrink-0 hover:text-[var(--bt-red)]">หน้าแรก</Link>
        <span className="shrink-0">›</span>
        <span className="text-[var(--bt-navy)] font-semibold truncate min-w-0">{categoryName}</span>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--bt-navy)] mb-2">
        {categoryName}
      </h1>
      <p className="text-sm text-[var(--bt-muted)] mb-8">
        {description}
      </p>

      {page === 1 && lead && (
        <section className="grid gap-6 lg:grid-cols-3 mb-12">
          <div className="lg:col-span-2">
            <ArticleCard post={lead} variant="hero" priority />
          </div>
          <HeroSideGrid posts={rest.slice(0, 4)} />
        </section>
      )}

      <SectionTitle title={`${categoryName}ทั้งหมด`} />
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        {(page === 1 ? rest.slice(4) : posts).map((p) => (
          <ArticleCard key={p.id} post={p} variant="feature" />
        ))}
      </div>

      <div className="flex justify-center gap-3 mt-10">
        {page > 1 && (
          <Link
            href={`/category/${slug}?page=${page - 1}`}
            className="h-10 px-5 rounded-full bg-white border border-[var(--bt-line)] inline-flex items-center text-sm font-semibold text-[var(--bt-navy)] hover:border-[var(--bt-navy)]"
          >
            ‹ ก่อนหน้า
          </Link>
        )}
        {hasNext && (
          <Link
            href={`/category/${slug}?page=${page + 1}`}
            className="h-10 px-5 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white inline-flex items-center text-sm font-bold transition-colors"
          >
            ถัดไป ›
          </Link>
        )}
      </div>
    </div>
  );
}
