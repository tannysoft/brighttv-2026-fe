import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPosts, getUserBySlug } from "@/lib/wp";
import { stripHtml } from "@/lib/utils";
import ArticleCard from "@/components/ArticleCard";
import HeroSideGrid from "@/components/HeroSideGrid";
import SectionTitle from "@/components/SectionTitle";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";

export const revalidate = 600;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const user = await getUserBySlug(slug);
  if (!user) return { title: "ไม่พบผู้เขียน" };
  return {
    title: `${user.name} — ผู้เขียน`,
    description:
      stripHtml(user.description) ||
      `รวมบทความทั้งหมดจาก ${user.name} บน BRIGHT TV`,
  };
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || "1"));

  const user = await getUserBySlug(slug);
  if (!user) notFound();

  // Page 1: 1 hero + 4 side + 12 grid = 17; page 2+: 12 grid only.
  const perPage = page === 1 ? 17 : 12;
  const posts = await getPosts({ author: user.id, perPage, page });
  if (!posts.length && page === 1) notFound();

  const [lead, ...rest] = posts;
  const hasNext = posts.length === perPage;
  const description =
    stripHtml(user.description) ||
    `รวมบทความทั้งหมดจาก ${user.name} บน BRIGHT TV`;
  const avatar =
    user.acf?.author_image ||
    user.avatar_urls?.["96"] ||
    user.avatar_urls?.["48"] ||
    user.avatar_urls?.["24"] ||
    "";

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "หน้าแรก", url: "/" },
            { name: "ผู้เขียน", url: "/author" },
            { name: user.name, url: `/author/${slug}` },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name: user.name,
              url: `https://www.brighttv.co.th/author/${slug}`,
              description,
              image: avatar || undefined,
            },
          },
        ]}
      />
      <nav className="text-xs text-[var(--bt-muted)] mb-4 flex items-center gap-2 whitespace-nowrap overflow-hidden">
        <Link href="/" className="shrink-0 hover:text-[var(--bt-red)]">หน้าแรก</Link>
        <span className="shrink-0">›</span>
        <span className="shrink-0">ผู้เขียน</span>
        <span className="shrink-0">›</span>
        <span className="text-[var(--bt-navy)] font-semibold truncate min-w-0">
          {user.name}
        </span>
      </nav>

      {/* Author header */}
      <header className="mb-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-8 border-b border-[var(--bt-line)]">
        <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-[var(--bt-navy)] flex items-center justify-center">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={user.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="text-3xl sm:text-4xl font-extrabold text-white">
              {user.name.slice(0, 1)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--bt-red)] mb-1">
            ผู้เขียน
          </p>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-[var(--bt-navy)] leading-tight">
            {user.name}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-[var(--bt-muted)] clamp-3">
              {description}
            </p>
          )}
        </div>
      </header>

      {page === 1 && lead && (
        <section className="grid gap-6 lg:grid-cols-3 mb-12">
          <div className="lg:col-span-2">
            <ArticleCard post={lead} variant="hero" priority />
          </div>
          <HeroSideGrid posts={rest.slice(0, 4)} />
        </section>
      )}

      <SectionTitle title={`ทุกบทความจาก ${user.name}`} />
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        {(page === 1 ? rest.slice(4) : posts).map((p) => (
          <ArticleCard key={p.id} post={p} variant="feature" />
        ))}
      </div>

      <div className="flex justify-center gap-3 mt-10">
        {page > 1 && (
          <Link
            href={`/author/${slug}?page=${page - 1}`}
            className="h-10 px-5 rounded-full bg-white border border-[var(--bt-line)] inline-flex items-center text-sm font-semibold text-[var(--bt-navy)] hover:border-[var(--bt-navy)]"
          >
            ‹ ก่อนหน้า
          </Link>
        )}
        {hasNext && (
          <Link
            href={`/author/${slug}?page=${page + 1}`}
            className="h-10 px-5 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white inline-flex items-center text-sm font-bold transition-colors"
          >
            ถัดไป ›
          </Link>
        )}
      </div>
    </div>
  );
}
