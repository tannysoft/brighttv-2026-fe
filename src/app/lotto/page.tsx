import Link from "next/link";
import type { Metadata } from "next";
import { getLottoLatest, getPosts } from "@/lib/wp";
import { stripHtml } from "@/lib/utils";
import ArticleCard from "@/components/ArticleCard";
import SectionTitle from "@/components/SectionTitle";
import JsonLd from "@/components/JsonLd";
import LottoChecker from "@/components/LottoChecker";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema";

export const revalidate = 1800;

const LOTTO_CATEGORY_ID = 124708;

export const metadata: Metadata = {
  title: "ตรวจหวย — ผลสลากกินแบ่งรัฐบาลงวดล่าสุด",
  description:
    "ตรวจหวยรัฐบาลงวดล่าสุด พร้อมผลรางวัลที่ 1, เลขท้าย 2 ตัว, เลขหน้า 3 ตัว, เลขท้าย 3 ตัว, รางวัลข้างเคียง และรางวัลที่ 2-5 ครบทุกรางวัลจาก BRIGHT TV",
};

export default async function LottoPage() {
  const [result, lottoPosts] = await Promise.all([
    getLottoLatest(),
    getPosts({ categories: LOTTO_CATEGORY_ID, perPage: 13 }),
  ]);

  const first = result?.prizes.find((p) => p.id === "prizeFirst")?.number?.[0] || "—";
  const near = result?.prizes.find((p) => p.id === "prizeFirstNear")?.number || [];
  const second = result?.prizes.find((p) => p.id === "prizeSecond")?.number || [];
  const third = result?.prizes.find((p) => p.id === "prizeThird")?.number || [];
  const forth = result?.prizes.find((p) => p.id === "prizeForth")?.number || [];
  const fifth = result?.prizes.find((p) => p.id === "prizeFifth")?.number || [];
  const front3 = result?.runningNumbers.find((p) => p.id === "runningNumberFrontThree")?.number || [];
  const back3 = result?.runningNumbers.find((p) => p.id === "runningNumberBackThree")?.number || [];
  const back2 = result?.runningNumbers.find((p) => p.id === "runningNumberBackTwo")?.number?.[0] || "—";

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8">
      <JsonLd
        data={[
          collectionPageSchema({
            url: "/lotto",
            name: "ตรวจหวย — ผลสลากกินแบ่งรัฐบาลงวดล่าสุด",
            description: "ผลสลากกินแบ่งรัฐบาลงวดล่าสุด พร้อมข่าวหวยจาก BRIGHT TV",
          }),
          breadcrumbSchema([
            { name: "หน้าแรก", url: "/" },
            { name: "ตรวจหวย", url: "/lotto" },
          ]),
        ]}
      />

      <nav className="text-xs text-[var(--bt-muted)] mb-4 flex items-center gap-2">
        <Link href="/" className="hover:text-[var(--bt-red)]">หน้าแรก</Link>
        <span>›</span>
        <span className="text-[var(--bt-navy)] font-semibold">ตรวจหวย</span>
      </nav>

      {/* Hero */}
      <header className="mb-6">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[var(--bt-navy)]">
          ตรวจหวย
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[var(--bt-muted)]">
          ผลสลากกินแบ่งรัฐบาลงวดประจำวันที่{" "}
          <span className="font-bold text-[var(--bt-red)]">
            {result?.date || "—"}
          </span>
        </p>
      </header>

      {/* Main layout: result + checker sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2 rounded-3xl overflow-hidden border border-[var(--bt-line)] shadow-sm bg-white">
        {/* Header strip */}
        <div className="bg-gradient-to-r from-[var(--bt-navy)] to-[#0a4570] px-6 py-5 text-white">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] !text-white/70 font-bold">
                BRIGHT TV
              </p>
              <h2 className="text-xl sm:text-2xl font-extrabold !text-white">
                ผลสลากกินแบ่งรัฐบาล
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[11px] !text-white/70">ประจำงวดวันที่</p>
              <p className="text-base sm:text-lg font-bold !text-white">
                {result?.date || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Main prizes */}
        <div className="p-5 sm:p-7 bg-[var(--bt-red)]">
          {/* Prize 1 — big */}
          <div className="bg-[var(--bt-text)] rounded-2xl py-6 sm:py-8 px-4 text-center shadow-inner">
            <p className="text-xs sm:text-sm font-bold !text-white/70 uppercase tracking-widest">
              รางวัลที่ 1
            </p>
            <p className="mt-0.5 text-[10px] sm:text-xs !text-white/60">
              รางวัลละ 6,000,000 บาท
            </p>
            <p className="mt-2 text-[56px] sm:text-[88px] leading-none font-extrabold tabular-nums !text-white tracking-wide">
              {first}
            </p>
          </div>

          {/* Running numbers — 3 boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <StatBox title="เลขท้าย 2 ตัว" values={[back2]} />
            <StatBox title="เลขหน้า 3 ตัว" values={front3} />
            <StatBox title="เลขท้าย 3 ตัว" values={back3} />
          </div>

          {/* Near first */}
          <div className="mt-4 rounded-xl bg-white/95 p-4 text-center">
            <p className="text-[11px] font-bold text-[var(--bt-red)] uppercase tracking-wider">
              รางวัลข้างเคียงรางวัลที่ 1
            </p>
            <p className="mt-1 text-2xl sm:text-3xl font-extrabold tabular-nums text-[var(--bt-text)] flex items-center justify-center gap-4">
              {near.length > 0
                ? near.map((n, i) => (
                    <span key={i} className="inline-flex items-center gap-4">
                      {i > 0 && <span className="text-[var(--bt-red)] text-xs">●</span>}
                      {n}
                    </span>
                  ))
                : "—"}
            </p>
          </div>
        </div>

        {/* Other prizes */}
        <div className="p-5 sm:p-8 bg-white space-y-6">
          <PrizeList title="รางวัลที่ 2" reward="รางวัลละ 200,000 บาท" numbers={second} density="loose" />
          <PrizeList title="รางวัลที่ 3" reward="รางวัลละ 80,000 บาท" numbers={third} density="loose" />
          <PrizeList title="รางวัลที่ 4" reward="รางวัลละ 40,000 บาท" numbers={forth} density="dense" />
          <PrizeList title="รางวัลที่ 5" reward="รางวัลละ 20,000 บาท" numbers={fifth} density="dense" />
        </div>

        {/* Footer note */}
        <div className="px-6 py-4 border-t border-[var(--bt-line)] bg-[var(--bt-bg)] text-center">
          <p className="text-xs text-[var(--bt-muted)]">
            ข้อมูลผลรางวัลโดยสำนักงานสลากกินแบ่งรัฐบาล — กรุณาตรวจสอบกับสลากต้นฉบับก่อนรับรางวัล
          </p>
        </div>
      </section>

      {/* Checker sidebar */}
      <div className="lg:col-span-1">
        <LottoChecker result={result} />
      </div>
      </div>

      {/* Lottery articles */}
      {lottoPosts.length > 0 && (
        <section className="mt-14">
          <SectionTitle title="ข่าวหวยล่าสุด" href={`/category/lotto`} />

          {/* Featured first post */}
          <div className="grid gap-6 lg:grid-cols-3 mb-10">
            <div className="lg:col-span-2">
              <ArticleCard post={lottoPosts[0]} variant="hero" priority />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
              {lottoPosts.slice(1, 5).map((p) => (
                <ArticleCard key={p.id} post={p} variant="compact" />
              ))}
            </div>
          </div>

          {/* Grid of remaining posts */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {lottoPosts.slice(5, 13).map((p) => (
              <ArticleCard key={p.id} post={p} variant="feature" />
            ))}
          </div>

          <div className="flex justify-center mt-10">
            <Link
              href="/category/lotto"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white text-sm font-bold transition-colors"
            >
              ดูข่าวหวยทั้งหมด
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function StatBox({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded-xl bg-white p-4 text-center flex flex-col justify-center min-h-[120px]">
      <p className="text-xs sm:text-[13px] font-bold text-[var(--bt-red)] uppercase tracking-wider">
        {title}
      </p>
      <p className="mt-1 text-2xl sm:text-3xl lg:text-4xl font-extrabold tabular-nums text-[var(--bt-text)] flex items-center justify-center gap-2 flex-wrap">
        {values.length > 0
          ? values.map((n, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                {i > 0 && <span className="text-[var(--bt-red)] text-xs">●</span>}
                {n}
              </span>
            ))
          : "—"}
      </p>
    </div>
  );
}

function PrizeList({
  title,
  reward,
  numbers,
  density = "loose",
}: {
  title: string;
  reward: string;
  numbers: string[];
  /** loose = few numbers (prize 2-3), dense = many numbers (prize 4-5) */
  density?: "loose" | "dense";
}) {
  const gridClass =
    density === "dense"
      ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6"
      : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5";
  const numClass =
    density === "dense"
      ? "text-sm sm:text-[15px] py-2 px-2"
      : "text-base sm:text-lg py-2.5 px-3";
  return (
    <div>
      <div className="flex items-baseline justify-between border-b-2 border-[var(--bt-line)] pb-2 mb-3">
        <h3 className="text-base sm:text-lg font-extrabold text-[var(--bt-navy)] flex items-center">
          <span className="inline-block w-1.5 h-5 rounded-sm mr-2.5 bg-[var(--bt-red)]" />
          {title}
        </h3>
        <span className="text-xs text-[var(--bt-muted)] font-semibold">{reward}</span>
      </div>
      {numbers.length > 0 ? (
        <div className={`grid ${gridClass} gap-2`}>
          {numbers.map((n, i) => (
            <div
              key={i}
              className={`${numClass} rounded-md bg-[var(--bt-bg)] border border-[var(--bt-line)] text-center font-extrabold tabular-nums text-[var(--bt-text)]`}
            >
              {n}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--bt-muted)] text-center py-3">—</p>
      )}
    </div>
  );
}
