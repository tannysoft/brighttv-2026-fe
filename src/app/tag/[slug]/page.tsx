import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPosts } from "@/lib/wp";
import { WP_API_ORIGIN } from "@/lib/env";
import ArticleCard from "@/components/ArticleCard";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema";

export const revalidate = 300;

const WP_BASE = `${WP_API_ORIGIN}/wp-json/wp/v2`;

async function getTagBySlug(slug: string) {
  try {
    const res = await fetch(`${WP_BASE}/tags?slug=${encodeURIComponent(slug)}`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ id: number; name: string; slug: string }>;
    return data?.[0] || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  return {
    title: tag ? `แท็ก: ${tag.name}` : "แท็ก",
    description: tag ? `รวมข่าวทั้งหมดที่ติดแท็ก ${tag.name} จาก BRIGHT TV` : undefined,
  };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || "1"));

  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const sp2 = new URLSearchParams();
  sp2.set("tags", String(tag.id));
  sp2.set("per_page", "16");
  sp2.set("page", String(page));
  sp2.set("_embed", "1");
  const res = await fetch(`${WP_BASE}/posts?${sp2.toString()}`, {
    next: { revalidate: 300 },
  });
  const posts = res.ok ? await res.json() : [];
  if (!posts.length && page === 1) notFound();

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8">
      <JsonLd
        data={[
          collectionPageSchema({
            url: `/tag/${slug}`,
            name: tag.name,
            description: `รวมข่าวที่ติดแท็ก ${tag.name}`,
          }),
          breadcrumbSchema([
            { name: "หน้าแรก", url: "/" },
            { name: `แท็ก: ${tag.name}`, url: `/tag/${slug}` },
          ]),
        ]}
      />
      <nav className="text-xs text-[var(--bt-muted)] mb-4 flex items-center gap-2">
        <Link href="/" className="hover:text-[var(--bt-red)]">หน้าแรก</Link>
        <span>›</span>
        <span className="text-[var(--bt-navy)] font-semibold">แท็ก: {tag.name}</span>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--bt-navy)] mb-2">
        {tag.name}
      </h1>
      <p className="text-sm text-[var(--bt-muted)] mb-8">
        รวมข่าวทั้งหมดที่ติดแท็ก {tag.name}
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((p: { id: number }) => (
          <ArticleCard key={p.id} post={p as never} variant="feature" />
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
        {posts.length === 16 && (
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
