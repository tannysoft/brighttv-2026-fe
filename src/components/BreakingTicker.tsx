import Link from "next/link";
import { getPosts } from "@/lib/wp";
import { stripHtml } from "@/lib/utils";

export default async function BreakingTicker() {
  const posts = await getPosts({ perPage: 10 });
  if (!posts.length) return null;
  const items = posts.map((p) => ({
    title: stripHtml(p.title.rendered),
    href: `/news/${p.slug}`,
  }));
  // duplicate for seamless loop
  const loop = [...items, ...items];

  return (
    <div className="bg-[var(--bt-navy)] text-white">
      <div className="mx-auto max-w-[1240px] px-4 h-11 flex items-center gap-3 overflow-hidden">
        <span className="shrink-0 inline-flex items-center gap-2 px-3 h-7 rounded-full bg-[var(--bt-red)] !text-white text-[12px] font-bold uppercase tracking-wide">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
          ข่าวด่วน
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="bt-marquee flex whitespace-nowrap will-change-transform">
            {loop.map((it, i) => (
              <Link
                key={i}
                href={it.href}
                className="inline-flex items-center gap-3 pr-8 text-[13px] text-white/90 hover:text-white"
              >
                <span className="text-[var(--bt-red)]">●</span>
                {it.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
