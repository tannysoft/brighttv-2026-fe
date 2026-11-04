import Link from "next/link";
import type { Metadata } from "next";
import { getPosts, type WPPost } from "@/lib/wp";
import { getPostPath, stripHtml, timeAgoTH } from "@/lib/utils";
import { pagePath } from "@/lib/categories";
import { SITE_ORIGIN } from "@/lib/env";
import { HOROSCOPE_TAGS, ZODIACS, dayColorOf } from "@/lib/horoscope-data";
import ArticleCard from "@/components/ArticleCard";
import SectionTitle from "@/components/SectionTitle";
import JsonLd from "@/components/JsonLd";
import NumerologyCalc from "@/components/horoscope/NumerologyCalc";
import PickACard from "@/components/horoscope/PickACard";
import BirthProfile from "@/components/horoscope/BirthProfile";
import { getCard, pickCardId } from "@/lib/horoscope";
import { DEFAULT_OG_IMAGE, SITE_NAME, breadcrumbSchema, collectionPageSchema } from "@/lib/schema";

// Horoscope hub: daily/weekly/monthly readings, the 12 signs, interactive
// tools and the latest stories. (/horoscope/page/N and articles are app/[...slug].)
export const revalidate = 600;

const CATEGORY_ID = 14322; // ดูดวง
const PATH = "/horoscope";
const TITLE = "ดูดวงวันนี้ ดวงรายวัน ดวง 12 ราศี ไพ่ทาโรต์ สีมงคล";
const DESCRIPTION =
  "ดูดวงวันนี้ ดวงรายวัน รายสัปดาห์ รายเดือน ดวง 12 ราศี ดวงความรัก ดวงการเงิน เปิดไพ่ทาโรต์ประจำวัน คำนวณเลขศาสตร์วันเกิด และสีประจำวันเกิด อัปเดตทุกวันจาก BRIGHT TV";

/** Tag page URL (WordPress-style lowercase percent-encoding). */
const tagHref = (name: string) => `/tag/${encodeURIComponent(name).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase())}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH, types: { "application/rss+xml": "/feed/horoscope" } },
  openGraph: { url: PATH, title: TITLE, description: DESCRIPTION, type: "website", siteName: SITE_NAME, locale: "th_TH", images: [DEFAULT_OG_IMAGE] },
};

export default async function HoroscopePage() {
  const byTag = (tags: number, perPage: number) => getPosts({ tags, perPage });
  const todayCardId = await pickCardId("today");
  const todayCard = todayCardId ? await getCard(todayCardId) : null;
  const [daily, weekly, monthly, love, money, latest, ...zodiacPosts] = await Promise.all([
    byTag(HOROSCOPE_TAGS.daily, 4),
    byTag(HOROSCOPE_TAGS.weekly, 1),
    byTag(HOROSCOPE_TAGS.monthly, 1),
    byTag(HOROSCOPE_TAGS.love, 4),
    byTag(HOROSCOPE_TAGS.money, 4),
    getPosts({ categories: CATEGORY_ID, perPage: 13 }),
    ...ZODIACS.map((z) => byTag(z.tag, 1)),
  ]);

  // Today in Thailand
  const now = new Date();
  const today = now.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
  const weekday = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })).getDay();
  const todayColor = dayColorOf(weekday);

  // Newest horoscope story leads (the daily/weekly tags aren't used on every story).
  const lead = latest[0] ?? daily[0];
  const listed: WPPost[] = [...latest, ...daily].filter((p, i, a) => a.findIndex((q) => q.id === p.id) === i);

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-8">
      <JsonLd
        data={[
          collectionPageSchema({ url: PATH, name: TITLE, description: DESCRIPTION }),
          breadcrumbSchema([
            { name: "หน้าแรก", url: "/" },
            { name: "ดูดวง", url: PATH },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: listed.slice(0, 12).map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${SITE_ORIGIN}${getPostPath(p)}`,
            })),
          },
        ]}
      />
      <nav className="text-xs text-[var(--bt-muted)] mb-4 flex items-center gap-2">
        <Link href="/" className="hover:text-[var(--bt-red)]">หน้าแรก</Link>
        <span>›</span>
        <span className="text-[var(--bt-navy)] font-semibold">ดูดวง</span>
      </nav>

      {/* Today */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-[var(--bt-navy)]">ดูดวงวันนี้</h1>
          <p className="mt-2 text-sm sm:text-base text-[var(--bt-muted)]">{today}</p>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-[var(--bt-line)] bg-white py-1.5 pl-1.5 pr-5 shadow-sm">
          <span className="h-10 w-10 rounded-full border-2 border-white shadow" style={{ background: todayColor.hex }} />
          <span className="text-sm">
            <span className="block text-[11px] text-[var(--bt-muted)]">สีประจำ{todayColor.day}</span>
            <span className="font-extrabold text-[var(--bt-navy)]">{todayColor.color}</span>
          </span>
        </div>
      </header>

      {/* Daily reading + weekly/monthly */}
      <section className="grid gap-6 lg:grid-cols-3 mb-12">
        <div className="lg:col-span-2">{lead && <ArticleCard post={lead} variant="hero" priority />}</div>
        <div className="space-y-4">
          <ReadingLink label="ดวงรายสัปดาห์" post={weekly[0]} href={tagHref("ดวงรายสัปดาห์")} />
          <ReadingLink label="ดวงรายเดือน" post={monthly[0]} href={tagHref("ดวงรายเดือน")} />
          <ReadingLink label="ดวงรายวัน" post={daily[0]} href={tagHref("ดวงรายวัน")} />
        </div>
      </section>

      {/* 12 signs */}
      <section className="mb-12" aria-labelledby="zodiac-title">
        <SectionTitle title="ดวง 12 ราศี" />
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" id="zodiac-title">
          {ZODIACS.map((z, i) => {
            const p = zodiacPosts[i]?.[0];
            return (
              <li key={z.tag} className="rounded-2xl border border-[var(--bt-line)] bg-white p-4 hover:border-[var(--bt-navy)] transition-colors">
                <Link href={tagHref(z.name)} className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--bt-navy)] text-xl !text-white" aria-hidden>
                    {z.symbol}
                  </span>
                  <span>
                    <span className="block font-extrabold text-[var(--bt-navy)] leading-tight">{z.name}</span>
                    <span className="text-[11px] text-[var(--bt-muted)]">{z.en}</span>
                  </span>
                </Link>
                {p && (
                  <Link href={getPostPath(p)} className="mt-3 block text-[13px] leading-snug text-[var(--bt-text)] line-clamp-2 hover:text-[var(--bt-red)]">
                    {stripHtml(p.title.rendered)}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Personal profile: by day of birth / zodiac, from the astrologers' articles */}
      <div className="mb-12">
        <BirthProfile defaultDay={todayColor.key} />
      </div>

      {/* Pick a card (archive of tarot readers' spreads) + numerology */}
      <section className="mb-4 grid gap-4 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2">{todayCard && <PickACard initial={todayCard} />}</div>
        <NumerologyCalc />
      </section>
      <p className="mb-12 text-[11px] text-[var(--bt-muted)]">* คำทำนาย ไพ่ และเลขศาสตร์ เป็นความเชื่อส่วนบุคคล โปรดใช้วิจารณญาณ</p>

      {/* Love & money */}
      <div className="grid gap-10 lg:grid-cols-2 mb-12">
        <Shelf title="ดวงความรัก" href={tagHref("ดวงความรัก")} posts={love} />
        <Shelf title="ดวงการเงิน" href={tagHref("ดวงการเงิน")} posts={money} />
      </div>

      {/* Latest */}
      <section>
        <SectionTitle title="ดูดวงล่าสุด" />
        <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
          {latest.slice(1, 13).map((p) => (
            <ArticleCard key={p.id} post={p} variant="feature" />
          ))}
        </div>
        <div className="flex justify-center mt-10">
          <Link
            href={pagePath(PATH, 2)}
            className="h-11 px-6 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white inline-flex items-center text-sm font-bold"
          >
            ดูดวงทั้งหมด ›
          </Link>
        </div>
      </section>
    </div>
  );
}

function ReadingLink({ label, post, href }: { label: string; post?: WPPost; href: string }) {
  return (
    <div className="rounded-2xl border border-[var(--bt-line)] bg-white p-4">
      <Link href={href} className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--bt-red)] hover:underline">
        {label} ›
      </Link>
      {post ? (
        <>
          <Link href={getPostPath(post)} className="mt-1 block font-bold leading-snug text-[var(--bt-navy)] line-clamp-2 hover:text-[var(--bt-red)]">
            {stripHtml(post.title.rendered)}
          </Link>
          <p className="mt-1 text-[11px] text-[var(--bt-muted)]">{timeAgoTH(post.date)}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-[var(--bt-muted)]">—</p>
      )}
    </div>
  );
}

function Shelf({ title, href, posts }: { title: string; href: string; posts: WPPost[] }) {
  if (!posts.length) return null;
  return (
    <section>
      <SectionTitle title={title} href={href} />
      <div className="space-y-4">
        {posts.map((p) => (
          <ArticleCard key={p.id} post={p} variant="compact" />
        ))}
      </div>
    </section>
  );
}
