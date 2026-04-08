import Link from "next/link";
import type { Metadata } from "next";
import { getPosts } from "@/lib/wp";
import ArticleCard from "@/components/ArticleCard";
import SectionTitle from "@/components/SectionTitle";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ค้นหาข่าว",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const page = Math.max(1, Number(sp.page || "1"));

  const posts = q ? await getPosts({ search: q, perPage: 16, page }) : [];
  const hasNext = posts.length === 16;

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--bt-navy)]">ค้นหาข่าว</h1>
      <form action="/search" className="mt-5 flex items-center bg-[var(--bt-bg)] rounded-full pl-5 pr-1 h-12 border border-[var(--bt-line)] focus-within:border-[var(--bt-navy)] max-w-2xl">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาคำที่ต้องการ..."
          className="bg-transparent outline-none flex-1 px-2 text-base text-[var(--bt-text)] placeholder:text-[var(--bt-muted)]"
          autoFocus
        />
        <button
          type="submit"
          className="h-10 px-5 rounded-full bg-[var(--bt-navy)] text-white text-sm font-bold hover:bg-[var(--bt-navy-700)]"
        >
          ค้นหา
        </button>
      </form>

      {q && (
        <p className="mt-4 text-sm text-[var(--bt-muted)]">
          ผลการค้นหาสำหรับ <span className="font-bold text-[var(--bt-navy)]">“{q}”</span>
        </p>
      )}

      <div className="mt-8">
        {!q && (
          <p className="text-[var(--bt-muted)]">พิมพ์คำค้นหาเพื่อเริ่มต้น</p>
        )}
        {q && posts.length === 0 && (
          <div className="py-10 text-center text-[var(--bt-muted)]">
            ไม่พบบทความที่ตรงกับคำค้นหานี้
          </div>
        )}
        {posts.length > 0 && (
          <>
            <SectionTitle title={`พบ ${posts.length} ผลลัพธ์`} />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {posts.map((p) => (
                <ArticleCard key={p.id} post={p} variant="feature" />
              ))}
            </div>
            <div className="flex justify-center gap-3 mt-10">
              {page > 1 && (
                <Link
                  href={`/search?q=${encodeURIComponent(q)}&page=${page - 1}`}
                  className="h-10 px-5 rounded-full bg-white border border-[var(--bt-line)] inline-flex items-center text-sm font-semibold text-[var(--bt-navy)] hover:border-[var(--bt-navy)]"
                >
                  ‹ ก่อนหน้า
                </Link>
              )}
              {hasNext && (
                <Link
                  href={`/search?q=${encodeURIComponent(q)}&page=${page + 1}`}
                  className="h-10 px-5 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white inline-flex items-center text-sm font-bold transition-colors"
                >
                  ถัดไป ›
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
