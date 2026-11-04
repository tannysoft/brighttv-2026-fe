import Image from "next/image";
import Link from "next/link";
import { getPopularTags, getPosts, getTopTags, type WPPost } from "@/lib/wp";
import { getFeaturedImage, getPostPath, stripHtml, timeAgoTH } from "@/lib/utils";

const PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'><rect width='16' height='9' fill='%23eef3f7'/></svg>";

type Trend = { id: number; name: string; slug: string; count: number; post: WPPost | null };

/**
 * "Social Trend": the topics (tags) most written about in the latest home
 * page stories, ranked by story count, each with its newest story. Falls
 * back to all-time popular tags when the trending list is empty.
 */
export default async function SocialTrend() {
  let tags = await getTopTags({ isHome: true });
  if (!tags.length) tags = (await getPopularTags(20)).map((t) => ({ id: t.id, name: t.name, slug: t.slug, count: 0 }));
  const seen = new Set<string>();
  tags = tags.filter((t) => !seen.has(t.slug.toLowerCase()) && seen.add(t.slug.toLowerCase()));
  if (!tags.length) return null;

  // Newest stories for the top 11 (3 cards + 8 rows) (cached fetches, in parallel). Each trend
  // then takes its newest story that no higher-ranked trend already shows,
  // so the same story never appears twice.
  const topTrends = tags.slice(0, 11);
  const candidates = await Promise.all(topTrends.map((t) => getPosts({ tags: t.id, perPage: 6 })));
  const used = new Set<number>();
  const trends: Trend[] = topTrends.map((t, i) => {
    const post = candidates[i].find((p) => !used.has(p.id)) ?? null;
    if (post) used.add(post.id);
    return { ...t, name: stripHtml(t.name), post };
  });
  const top = trends.slice(0, 3);
  const rising = trends.slice(3, 11);
  const more = tags.slice(11, 21);

  return (
    <section className="mt-14" aria-labelledby="social-trend-title">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--bt-red)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--bt-red)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--bt-red)]" />
            </span>
            Social Trend
          </p>
          <h2 id="social-trend-title" className="mt-1 text-2xl sm:text-3xl font-extrabold text-[var(--bt-navy)]">
            ประเด็นร้อนที่คนพูดถึงตอนนี้
          </h2>
        </div>
      </div>

      {/* Top 3 */}
      <div className="grid gap-4 md:grid-cols-3">
        {top.map((t, i) => (
          <TrendCard key={t.id} trend={t} rank={i + 1} />
        ))}
      </div>

      {/* 4–11 */}
      {rising.length > 0 && (
        <ol className="mt-4 grid gap-x-6 sm:grid-cols-2 rounded-2xl border border-[var(--bt-line)] bg-white px-4 sm:px-6">
          {rising.map((t, i) => (
            <li key={t.id} className="flex items-center gap-3 py-3 border-b border-[var(--bt-line)] last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
              <span className="w-6 shrink-0 text-center text-xl font-extrabold tabular-nums text-[var(--bt-navy)]/30">{i + 4}</span>
              <Link
                href={t.post ? getPostPath(t.post) : `/tag/${t.slug}`}
                className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--bt-navy-50)]"
                tabIndex={-1}
                aria-hidden
              >
                <Image
                  src={(t.post && getFeaturedImage(t.post, "medium")?.url) || PLACEHOLDER}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/tag/${t.slug}`} className="text-[15px] font-extrabold text-[var(--bt-navy)] hover:text-[var(--bt-red)]">
                  <span className="text-[var(--bt-red)]">#</span>
                  {t.name}
                </Link>
                {t.post && (
                  <Link href={getPostPath(t.post)} className="block truncate text-[13px] text-[var(--bt-muted)] hover:text-[var(--bt-text)]">
                    {stripHtml(t.post.title.rendered)}
                  </Link>
                )}
              </div>
              {t.count > 0 && (
                <span className="shrink-0 rounded-full bg-[var(--bt-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--bt-muted)] tabular-nums">
                  {t.count} ข่าว
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* Rest as hashtags */}
      {more.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {more.map((t) => (
            <Link
              key={t.id}
              href={`/tag/${t.slug}`}
              className="inline-flex items-center h-8 px-3.5 rounded-full bg-[var(--bt-bg)] border border-[var(--bt-line)] text-[13px] font-semibold text-[var(--bt-navy)] hover:bg-[var(--bt-navy)] hover:!text-white hover:border-[var(--bt-navy)] transition-colors"
            >
              <span className="text-[var(--bt-red)] mr-0.5">#</span>
              {stripHtml(t.name)}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function TrendCard({ trend, rank }: { trend: Trend; rank: number }) {
  const post = trend.post;
  const img = post ? getFeaturedImage(post, "large") : null;
  return (
    <article className="group relative overflow-hidden rounded-2xl bg-[var(--bt-navy)] min-h-[260px] flex flex-col justify-end">
      <Image
        src={img?.url || PLACEHOLDER}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 430px"
        className="object-cover opacity-60 transition-transform duration-500 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#071a2e] via-[#071a2e]/70 to-transparent" />
      <span className="absolute top-3 left-4 text-6xl font-extrabold leading-none !text-white/90 tabular-nums drop-shadow">{rank}</span>
      {rank === 1 && (
        <span className="absolute top-4 right-4 rounded-full bg-[var(--bt-red)] px-2.5 py-1 text-[11px] font-extrabold !text-white">
          🔥 มาแรง
        </span>
      )}
      <div className="relative p-5">
        <Link href={`/tag/${trend.slug}`} className="inline-flex items-center gap-2">
          <span className="text-xl sm:text-2xl font-extrabold !text-white hover:underline">#{trend.name}</span>
        </Link>
        {trend.count > 0 && <p className="mt-0.5 text-xs font-semibold !text-white/70">{trend.count} ข่าวล่าสุด</p>}
        {post && (
          <Link href={getPostPath(post)} className="mt-3 block">
            <p className="line-clamp-2 text-sm font-semibold leading-snug !text-white/95 group-hover:underline">
              {stripHtml(post.title.rendered)}
            </p>
            <p className="mt-1 text-[11px] !text-white/60">{timeAgoTH(post.date)}</p>
          </Link>
        )}
      </div>
    </article>
  );
}
