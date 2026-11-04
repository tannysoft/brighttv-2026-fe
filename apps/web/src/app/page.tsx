import Link from "next/link";
import {
  getLottoLatest,
  getMostViewPosts,
  getPosts,
} from "@/lib/wp";
import { breadcrumbSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";
import {
  DEFAULT_FEATURED_IMAGE,
  getFeaturedImage,
  getPostPath,
  hasVideo,
  sidebarPostToWPPost,
  stripHtml,
} from "@/lib/utils";
import ArticleCard from "@/components/ArticleCard";
import HeroSideGrid from "@/components/HeroSideGrid";
import PlayBadge from "@/components/PlayBadge";
import RankedItem from "@/components/RankedItem";
import SectionTitle from "@/components/SectionTitle";
import CategorySection from "@/components/CategorySection";
import CategoryColumnSection from "@/components/CategoryColumnSection";
import BreakingTicker from "@/components/BreakingTicker";
import SocialTrend from "@/components/SocialTrend";
import { HOMEPAGE_SECTIONS } from "@/lib/categories";

// ISR: render once, cache for 5 minutes, revalidate in background.
// DO NOT add `dynamic = "force-dynamic"` — it overrides revalidate and
// forces full SSR on every single request (the #1 cause of slow TTFB).
export const revalidate = 300;

const CRIME = HOMEPAGE_SECTIONS.find((c) => c.slug === "crime")!;
const MAIN_SECTIONS = HOMEPAGE_SECTIONS.filter((c) => c.slug !== "crime").slice(0, 3);
const SIDEBAR_SECTIONS = HOMEPAGE_SECTIONS.filter((c) => c.slug !== "crime").slice(3, 5);
const BOTTOM_SECTIONS = HOMEPAGE_SECTIONS.filter((c) => c.slug !== "crime").slice(5, 7);

const HOROSCOPE = { id: 14322, slug: "horoscope", name: "ดูดวง" };
const LOTTO = { id: 124708, slug: "lotto", name: "ตรวจหวย" };
const VIDEO = { id: 4, slug: "hot-clip", name: "วิดีโอ" };

export default async function HomePage() {
  // Pre-fetch ALL independent data in parallel. This turns 17 sequential
  // API calls (~5-17s) into ~3 parallel batches (~1-2s total). Each async
  // component below receives pre-fetched data instead of fetching its own.
  const [
    latest,
    breakingPosts,
    crimePosts,
    mostViewRaw,
    videoPosts,
  ] = await Promise.all([
    getPosts({ perPage: 13 }),
    getPosts({ perPage: 10 }),
    getPosts({ categories: CRIME.id, perPage: 5 }),
    getMostViewPosts(),
    getPosts({ categories: VIDEO.id, perPage: 5 }),
  ]);

  const [hero, ...rest] = latest;
  const featured = rest.slice(0, 4);
  const recent = rest.slice(4, 12);

  return (
    <>
      <BreakingTicker posts={breakingPosts} />

      <JsonLd data={[breadcrumbSchema([{ name: "หน้าแรก", url: "/" }])]} />

      <div className="mx-auto max-w-[1320px] px-4 py-8">
        {/* Accessible H1 for search engines — visually hidden so it doesn't
            disrupt the editorial layout, but gives crawlers a clear page topic. */}
        <h1 className="sr-only">BRIGHT TV — ข่าวล่าสุดวันนี้ ทันทุกสถานการณ์</h1>

        {/* HERO */}
        {hero && (
          <section className="grid gap-6 lg:grid-cols-3 mb-12">
            <div className="lg:col-span-2">
              <ArticleCard post={hero} variant="hero" priority />
            </div>
            <HeroSideGrid posts={featured.slice(0, 4)} />
          </section>
        )}

        {/* LATEST GRID */}
        <section className="mb-14">
          <SectionTitle title="ข่าวล่าสุด" href="/category/news" accent="red" />
          <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
            {recent.map((p) => (
              <ArticleCard key={p.id} post={p} variant="feature" />
            ))}
          </div>
        </section>

        {/* Paired main + sidebar rows. Each row is its own 2/1 grid so the
            headers in the left and right columns always start at the same Y,
            regardless of how tall the previous row's content was. */}
        <MainRow index={0} popular={mostViewRaw} />

        {/* Horoscope + Lottery — right under politics */}
        <HoroscopeLottoBlock />

        {/* Crime — full width, above economy */}
        <CrimeFullWidth posts={crimePosts} />

        <div className="space-y-12 mt-14">
          {MAIN_SECTIONS.slice(1).map((c, i) => (
            <MainRow key={c.id} index={i + 1} popular={mostViewRaw} />
          ))}
        </div>

        {/* Lifestyle + Health */}
        <div className="grid gap-10 lg:grid-cols-2 mt-12">
          {BOTTOM_SECTIONS.map((c) => (
            <CategoryColumnSection key={c.id} category={c} />
          ))}
        </div>

        {/* Video section */}
        <VideoSection posts={videoPosts} />

        {/* Social Trend (replaces the plain popular-tags cloud) */}
        <SocialTrend />
      </div>
    </>
  );
}

/** Category (2/3) with its sidebar (1/3): "most viewed" beside the first row. */
function MainRow({ index, popular }: { index: number; popular: import("@/lib/wp").SidebarPost[] }) {
  const c = MAIN_SECTIONS[index];
  const side = index === 0 ? null : SIDEBAR_SECTIONS[index - 1];
  return (
    <div className="grid gap-12 lg:grid-cols-3 items-start">
      <div className="lg:col-span-2">
        <CategorySection category={c} />
      </div>
      <aside>{index === 0 ? <PopularSidebar posts={popular} /> : side ? <SidebarList category={side} /> : null}</aside>
    </div>
  );
}

function CrimeFullWidth({ posts }: { posts: import("@/lib/wp").WPPost[] }) {
  if (!posts.length) return null;
  const [lead, ...rest] = posts;
  return (
    <section className="mt-14">
      <SectionTitle title={CRIME.name} href={`/category/${CRIME.slug}`} accent="red" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ArticleCard post={lead} variant="hero" />
        </div>
        <HeroSideGrid posts={rest.slice(0, 4)} />
      </div>
    </section>
  );
}

async function PopularSidebar({ posts: raw }: { posts: import("@/lib/wp").SidebarPost[] }) {
  let posts = raw.slice(0, 5).map(sidebarPostToWPPost);
  // No ranking (source down or no views yet): show the next latest stories
  // (after the 13 above) so the column is never blank.
  if (!posts.length) posts = (await getPosts({ perPage: 18 })).slice(13);
  if (!posts.length) return null;
  return (
    <section>
      <SectionTitle title="กำลังเป็นที่สนใจ" accent="red" />
      <ol className="space-y-5">
        {posts.map((p, i) => (
          <RankedItem key={p.id} post={p} rank={i + 1} />
        ))}
      </ol>
    </section>
  );
}

async function SidebarList({
  category,
}: {
  category: { id: number; slug: string; name: string };
}) {
  const posts = await getPosts({ categories: category.id, perPage: 3 });
  if (!posts.length) return null;
  return (
    <section>
      <SectionTitle title={category.name} href={`/category/${category.slug}`} />
      <div className="space-y-4">
        {posts.map((p) => (
          <ArticleCard key={p.id} post={p} variant="compact" />
        ))}
      </div>
    </section>
  );
}

async function HoroscopeLottoBlock() {
  const [horo, lottoResult, lottoPosts] = await Promise.all([
    getPosts({ categories: HOROSCOPE.id, perPage: 4 }),
    getLottoLatest(),
    getPosts({ categories: LOTTO.id, perPage: 4 }),
  ]);

  const first = lottoResult?.prizes.find((p) => p.id === "prizeFirst")?.number?.[0] || "";
  const front3 = lottoResult?.runningNumbers.find((p) => p.id === "runningNumberFrontThree")?.number || [];
  const back3 = lottoResult?.runningNumbers.find((p) => p.id === "runningNumberBackThree")?.number || [];
  const back2 = lottoResult?.runningNumbers.find((p) => p.id === "runningNumberBackTwo")?.number?.[0] || "";
  const near = lottoResult?.prizes.find((p) => p.id === "prizeFirstNear")?.number || [];

  return (
    <div className="grid gap-8 lg:grid-cols-3 mt-14">
      {/* HOROSCOPE */}
      <section className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-[var(--bt-navy)] to-[#0a4570] p-6 sm:p-7 text-white">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl sm:text-2xl font-extrabold">ดูดวง</h2>
          <Link
            href={`/category/${HOROSCOPE.slug}`}
            className="text-xs font-semibold text-white/80 hover:text-white"
          >
            ดูทั้งหมด ›
          </Link>
        </div>
        {horo[0] && (
          <Link href={getPostPath(horo[0])} className="group block mb-5">
            <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-white/10">
              {(() => {
                const img = getFeaturedImage(horo[0], "large").url;
                return img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : null;
              })()}
              {hasVideo(horo[0]) && <PlayBadge size="md" />}
            </div>
            <h3 className="mt-3 text-base sm:text-lg font-bold leading-snug clamp-2 group-hover:text-[#ffd6d8] transition-colors">
              {stripHtml(horo[0].title.rendered)}
            </h3>
          </Link>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/15 pt-5">
          {horo.slice(1, 4).map((p) => {
            const img = getFeaturedImage(p, "large").url;
            return (
              <Link key={p.id} href={getPostPath(p)} className="group block">
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-white/10">
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                  )}
                  {hasVideo(p) && <PlayBadge size="sm" />}
                </div>
                <h4 className="mt-2 text-[12px] sm:text-[13px] font-semibold leading-snug clamp-2 group-hover:text-[#ffd6d8] transition-colors">
                  {stripHtml(p.title.rendered)}
                </h4>
              </Link>
            );
          })}
        </div>
      </section>

      {/* LOTTERY */}
      <section className="rounded-2xl bg-white border border-[var(--bt-line)] p-6 sm:p-7 shadow-sm flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--bt-navy)]">
              ผลสลากกินแบ่งฯ
            </h2>
            <p className="text-xs text-[var(--bt-muted)] mt-1 font-semibold">
              ประจำงวดวันที่ {lottoResult?.date || "—"}
            </p>
          </div>
          <Link
            href="/lotto"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white text-xs font-bold transition-colors shrink-0"
          >
            ตรวจหวย
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="rounded-xl bg-[var(--bt-red)] p-3 sm:p-4 space-y-3">
          {/* Big first prize */}
          <div className="bg-[var(--bt-text)] rounded-lg py-4 px-3 text-center !text-white">
            <p className="text-xs font-bold !text-white/80">รางวัลที่ 1</p>
            <p className="mt-1 text-3xl sm:text-4xl font-extrabold tabular-nums !text-white whitespace-nowrap">
              {first || "—"}
            </p>
          </div>

          {/* Last 2 digits */}
          <div className="bg-white rounded-lg py-3 px-3 text-center">
            <p className="text-[11px] font-bold text-[var(--bt-red)]">เลขท้าย 2 ตัว</p>
            <p className="mt-0.5 text-3xl sm:text-4xl font-extrabold tabular-nums text-[var(--bt-text)]">
              {back2 || "—"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="rounded-lg border border-[var(--bt-line)] p-3 text-center">
            <p className="text-[11px] font-bold text-[var(--bt-red)]">เลขหน้า 3 ตัว</p>
            <p className="mt-1 text-xl sm:text-2xl font-extrabold tabular-nums text-[var(--bt-text)] flex items-center justify-center gap-2">
              {front3.length ? front3.map((n, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  {i > 0 && <span className="text-[var(--bt-red)] text-[10px]">●</span>}
                  {n}
                </span>
              )) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--bt-line)] p-3 text-center">
            <p className="text-[11px] font-bold text-[var(--bt-red)]">เลขท้าย 3 ตัว</p>
            <p className="mt-1 text-xl sm:text-2xl font-extrabold tabular-nums text-[var(--bt-text)] flex items-center justify-center gap-2">
              {back3.length ? back3.map((n, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  {i > 0 && <span className="text-[var(--bt-red)] text-[10px]">●</span>}
                  {n}
                </span>
              )) : "—"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-[var(--bt-bg)] p-3 text-center">
          <p className="text-[11px] font-bold text-[var(--bt-muted)] mb-1">
            รางวัลข้างเคียงรางวัลที่ 1
          </p>
          <p className="text-base font-extrabold tabular-nums text-[var(--bt-navy)] flex items-center justify-center gap-3">
            {near.length ? (
              near.map((n, i) => (
                <span key={i} className="inline-flex items-center gap-3">
                  {i > 0 && <span className="text-[var(--bt-red)] text-xs">●</span>}
                  {n}
                </span>
              ))
            ) : (
              "—"
            )}
          </p>
        </div>

        {/* Lottery articles list */}
        {lottoPosts.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[var(--bt-line)] flex-1 flex flex-col">
            <p className="flex items-center text-base sm:text-lg font-extrabold text-[var(--bt-navy)] mb-4">
              <span className="inline-block w-1.5 h-5 rounded-sm mr-2.5 bg-[var(--bt-red)]" />
              ข่าวหวยล่าสุด
            </p>
            <ul className="space-y-3 flex-1">
              {lottoPosts.slice(0, 3).map((p) => {
                const img = getFeaturedImage(p, "medium").url;
                return (
                  <li key={p.id}>
                    <Link
                      href={getPostPath(p)}
                      className="group flex items-start gap-3"
                    >
                      <div className="relative w-[88px] aspect-[16/9] shrink-0 overflow-hidden rounded-md bg-[var(--bt-navy-50)]">
                        {img && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                          />
                        )}
                        {hasVideo(p) && <PlayBadge size="sm" />}
                      </div>
                      <h4 className="flex-1 min-w-0 text-[12px] sm:text-[13px] font-bold leading-snug text-[var(--bt-text)] clamp-2 group-hover:text-[var(--bt-red)] transition-colors">
                        {stripHtml(p.title.rendered)}
                      </h4>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              href={`/category/${LOTTO.slug}`}
              className="mt-4 inline-flex items-center justify-center gap-2 h-10 rounded-full bg-[var(--bt-bg)] hover:bg-[var(--bt-navy)] hover:!text-white border border-[var(--bt-line)] hover:border-[var(--bt-navy)] text-[var(--bt-navy)] text-xs font-bold transition-colors"
            >
              ดูข่าวหวยทั้งหมด
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/>
                <path d="m12 5 7 7-7 7"/>
              </svg>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function VideoSection({ posts }: { posts: import("@/lib/wp").WPPost[] }) {
  if (!posts.length) return null;
  const [lead, ...rest] = posts;

  return (
    <section className="mt-14 relative -mx-4 sm:mx-0 overflow-hidden sm:rounded-3xl bg-[#071a2e] px-4 sm:px-10 py-10 sm:py-12">
      {/* Decorative glow — blue tones only, no red (avoids purple cast) */}
      <div className="pointer-events-none absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-[#1e6fb8] opacity-25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 w-[460px] h-[460px] rounded-full bg-[var(--bt-navy)] opacity-40 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--bt-red)] shadow-[0_0_30px_rgba(228,38,43,0.5)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-white ml-0.5"><path d="M8 5v14l11-7z"/></svg>
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--bt-red)]">Bright TV</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold !text-white leading-tight">วิดีโอ</h2>
            </div>
          </div>
          <Link
            href={`/category/${VIDEO.slug}`}
            className="hidden sm:inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur !text-white text-sm font-bold border border-white/15 transition-colors"
          >
            ดูทั้งหมด
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
          {/* Lead video */}
          {lead && (
            <Link href={getPostPath(lead)} className="group block lg:col-span-7 lg:h-full">
              <div className="relative aspect-[16/9] lg:aspect-auto lg:h-full rounded-2xl overflow-hidden bg-white/5 ring-1 ring-white/10">
                {(() => {
                  const img = getFeaturedImage(lead, "full").url;
                  return img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                    />
                  ) : null;
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                {/* Center play */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/40 group-hover:bg-white/25 group-hover:scale-110 transition-all">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="text-white ml-1"><path d="M8 5v14l11-7z"/></svg>
                    <span className="absolute inset-0 rounded-full ring-1 ring-white/25 animate-ping" />
                  </span>
                </div>

                {/* Featured badge */}
                <span className="absolute top-4 left-4 inline-flex items-center gap-2 h-7 px-3 rounded-full bg-[var(--bt-red)] !text-white text-[11px] font-extrabold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  วิดีโอแนะนำ
                </span>

                {/* Title overlay */}
                <div className="absolute left-5 right-5 bottom-5">
                  <h3 className="text-lg sm:text-2xl font-extrabold leading-snug !text-white clamp-2 drop-shadow-lg group-hover:text-[#ffd6d8] transition-colors">
                    {stripHtml(lead.title.rendered)}
                  </h3>
                </div>
              </div>
            </Link>
          )}

          {/* Side video list */}
          <div className="flex flex-col gap-3 lg:col-span-5">
            {rest.slice(0, 4).map((p) => {
              const img = getFeaturedImage(p, "large").url;
              return (
                <Link
                  key={p.id}
                  href={getPostPath(p)}
                  className="group flex items-center gap-3 p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] ring-1 ring-white/10 hover:ring-[var(--bt-red)]/40 transition-all"
                >
                  <div className="relative w-[120px] sm:w-[140px] aspect-[16/9] shrink-0 overflow-hidden rounded-lg bg-white/5">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm ring-1 ring-white/40 group-hover:bg-white/25 group-hover:scale-110 transition-all">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-white ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                      </span>
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] sm:text-[14px] font-bold leading-snug !text-white clamp-2 group-hover:text-[#ffd6d8] transition-colors">
                      {stripHtml(p.title.rendered)}
                    </h4>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

