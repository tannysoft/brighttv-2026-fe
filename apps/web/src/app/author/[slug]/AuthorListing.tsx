// Author listing, shared by /author/{slug} and /author/{slug}/page/{n}.
import { DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/schema";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPostsWindow, getUserBySlug } from "@/lib/wp";
import { listingWindow, stripHtml } from "@/lib/utils";
import { pagePath } from "@/lib/categories";
import { SITE_ORIGIN } from "@/lib/env";
import ArticleCard from "@/components/ArticleCard";
import HeroSideGrid from "@/components/HeroSideGrid";
import SectionTitle from "@/components/SectionTitle";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";

/** /author/{slug}, percent-encoded with lowercase hex like WordPress. */
export function authorPath(slug: string): string {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    // keep as is
  }
  return `/author/${encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase())}`;
}

export async function authorMetadata(slug: string, page: number): Promise<Metadata> {
  const user = await getUserBySlug(slug);
  if (!user) return { title: "ไม่พบผู้เขียน" };
  const url = pagePath(authorPath(slug), page);
  const title = `${user.name} — ผู้เขียน`;
  return {
    title: page > 1 ? `${title} หน้า ${page}` : title,
    description:
      stripHtml(user.description) ||
      `รวมบทความทั้งหมดจาก ${user.name} บน BRIGHT TV`,
    alternates: { canonical: url, types: { "application/rss+xml": `${authorPath(slug)}/feed` } },
    openGraph: { url, title, type: "profile", siteName: SITE_NAME, locale: "th_TH", images: [DEFAULT_OG_IMAGE] },
  };
}

export default async function AuthorListing({ slug, page }: { slug: string; page: number }) {
  const user = await getUserBySlug(slug);
  if (!user) notFound();

  // Page 1: 1 hero + 4 side + 12 grid = 17; page 2+: 12 grid only (by offset,
  // so pages don't overlap). An author with no stories still gets a page 1.
  const win = listingWindow(page, 17, 12);
  const { posts, total } = await getPostsWindow({ author: user.id, offset: win.offset, limit: win.limit });
  const totalPages = win.totalPages(total);
  if (page > totalPages || (page > 1 && !posts.length)) notFound();

  const [lead, ...rest] = posts;
  const base = authorPath(slug);
  const prev = page > 1 ? pagePath(base, page - 1) : null;
  const next = page < totalPages ? pagePath(base, page + 1) : null;
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
    <div className="mx-auto max-w-[1320px] px-4 py-8">
      {prev && <link rel="prev" href={prev} />}
      {next && <link rel="next" href={next} />}
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "หน้าแรก", url: "/" },
            { name: user.name, url: base },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name: user.name,
              url: `${SITE_ORIGIN}${base}`,
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
            {page > 1 && <span className="text-[var(--bt-muted)] text-xl sm:text-2xl font-bold"> หน้า {page}</span>}
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
      {!posts.length && (
        <p className="text-sm text-[var(--bt-muted)]">ยังไม่มีบทความจากผู้เขียนคนนี้</p>
      )}
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        {(page === 1 ? rest.slice(4) : posts).map((p) => (
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
