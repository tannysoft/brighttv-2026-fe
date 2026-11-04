// Shared layout of /lotto (latest draw) and /lotto/[date] (any past draw).
import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import SectionTitle from "@/components/SectionTitle";
import JsonLd from "@/components/JsonLd";
import LottoChecker from "@/components/LottoChecker";
import DrawPicker from "@/components/DrawPicker";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema";
import { drawSlug, prize, rewardOf, thaiDate, type LottoDraw } from "@/lib/lotto-check";
import type { WPPost } from "@/lib/wp";

const baht = (n: number) => (n ? n.toLocaleString("th-TH") : "—");

export default function LottoDrawView({
  draw,
  dates,
  lottoPosts,
  latest,
}: {
  draw: LottoDraw | null;
  dates: string[];
  lottoPosts: WPPost[];
  /** /lotto (true) or /lotto/[date] */
  latest: boolean;
}) {
  const label = draw ? thaiDate(draw.date) : "";
  const path = latest || !draw ? "/lotto" : `/lotto/${drawSlug(draw.date)}`;
  const first = prize(draw, "prizeFirst")[0] || "—";
  const near = prize(draw, "prizeFirstNear");
  const second = prize(draw, "prizeSecond");
  const third = prize(draw, "prizeThird");
  const forth = prize(draw, "prizeForth");
  const fifth = prize(draw, "prizeFifth");
  const front3 = prize(draw, "runningNumberFrontThree");
  const back3 = prize(draw, "runningNumberBackThree");
  const back2 = prize(draw, "runningNumberBackTwo")[0] || "—";

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8">
      <JsonLd
        data={[
          collectionPageSchema({
            url: path,
            name: `ตรวจหวย ${label ? `งวด ${label}` : "งวดล่าสุด"}`,
            description: `ผลสลากกินแบ่งรัฐบาล${label ? ` งวดวันที่ ${label}` : "งวดล่าสุด"} พร้อมข่าวหวยจาก BRIGHT TV`,
          }),
          breadcrumbSchema([
            { name: "หน้าแรก", url: "/" },
            { name: "ตรวจหวย", url: "/lotto" },
            ...(latest ? [] : [{ name: `งวด ${label}`, url: path }]),
          ]),
        ]}
      />

      <nav className="text-xs text-[var(--bt-muted)] mb-4 flex items-center gap-2">
        <Link href="/" className="hover:text-[var(--bt-red)]">หน้าแรก</Link>
        <span>›</span>
        {latest ? (
          <span className="text-[var(--bt-navy)] font-semibold">ตรวจหวย</span>
        ) : (
          <>
            <Link href="/lotto" className="hover:text-[var(--bt-red)]">ตรวจหวย</Link>
            <span>›</span>
            <span className="text-[var(--bt-navy)] font-semibold">งวด {label}</span>
          </>
        )}
      </nav>

      {/* Hero */}
      <header className="mb-6">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[var(--bt-navy)]">
          {latest ? "ตรวจหวย" : `ตรวจหวย งวด ${label}`}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[var(--bt-muted)]">
          ผลสลากกินแบ่งรัฐบาลงวดประจำวันที่{" "}
          <span className="font-bold text-[var(--bt-red)]">
            {label || "—"}
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
                {label || "—"}
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
              รางวัลละ {baht(rewardOf(draw, "prizeFirst"))} บาท
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
          <PrizeList title="รางวัลที่ 2" reward={`รางวัลละ ${baht(rewardOf(draw, "prizeSecond"))} บาท`} numbers={second} density="loose" />
          <PrizeList title="รางวัลที่ 3" reward={`รางวัลละ ${baht(rewardOf(draw, "prizeThird"))} บาท`} numbers={third} density="loose" />
          <PrizeList title="รางวัลที่ 4" reward={`รางวัลละ ${baht(rewardOf(draw, "prizeForth"))} บาท`} numbers={forth} density="dense" />
          <PrizeList title="รางวัลที่ 5" reward={`รางวัลละ ${baht(rewardOf(draw, "prizeFifth"))} บาท`} numbers={fifth} density="dense" />
        </div>

        {/* Footer note */}
        <div className="px-6 py-4 border-t border-[var(--bt-line)] bg-[var(--bt-bg)] text-center">
          <p className="text-xs text-[var(--bt-muted)]">
            ข้อมูลผลรางวัลโดยสำนักงานสลากกินแบ่งรัฐบาล — กรุณาตรวจสอบกับสลากต้นฉบับก่อนรับรางวัล
          </p>
        </div>
      </section>

      {/* Checker sidebar */}
      {/* Sticky on desktop, under the collapsed header */}
      <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-[76px] lg:self-start">
        <LottoChecker draw={draw} />
        <DrawArchive dates={dates} current={draw?.date ?? null} />
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

/** Past results: pick year + draw, plus links to the latest few draws. */
function DrawArchive({ dates, current }: { dates: string[]; current: string | null }) {
  if (!dates.length) return null;
  return (
    <section className="rounded-2xl bg-white border border-[var(--bt-line)] shadow-sm p-5">
      <h2 className="text-lg font-extrabold text-[var(--bt-navy)]">ผลสลากย้อนหลัง</h2>
      <p className="mt-0.5 text-[11px] text-[var(--bt-muted)]">
        ตั้งแต่ปี {Number(dates[dates.length - 1].slice(0, 4)) + 543} · {dates.length} งวด
      </p>
      <DrawPicker dates={dates} current={current} />
      <p className="mt-4 mb-2 text-[11px] font-bold text-[var(--bt-muted)]">งวดล่าสุด</p>
      <ul className="grid grid-cols-3 gap-1.5">
        {dates.slice(0, 6).map((d) => (
          <li key={d}>
            <Link
              href={`/lotto/${drawSlug(d)}`}
              aria-current={d === current ? "page" : undefined}
              className={`block rounded-lg py-2 text-center text-[13px] font-semibold transition-colors ${
                d === current
                  ? "bg-[var(--bt-navy)] !text-white"
                  : "bg-[var(--bt-bg)] text-[var(--bt-text)] hover:bg-[var(--bt-red)] hover:!text-white"
              }`}
            >
              {thaiDate(d, "short")}
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
