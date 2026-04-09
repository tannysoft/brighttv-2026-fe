import ArticleCard from "./ArticleCard";
import { formatViews, type WPPost } from "@/lib/wp";

// Leaderboard row used by both the homepage "กำลังเป็นที่สนใจ" and the
// article page "ข่าวยอดนิยม" sidebars. Left column stacks a big rank number
// on top and the formatted view count underneath, visually binding both
// "trending" metrics into the same accent block. Title column (ArticleCard
// variant="small") gets the remaining width without a floating pill
// competing for attention on the right.
export default function RankedItem({
  post,
  rank,
}: {
  post: WPPost;
  rank: number;
}) {
  const views = formatViews(post.views);
  return (
    <li className="flex gap-4 items-start">
      <div className="shrink-0 flex flex-col items-center pt-0.5 min-w-[44px]">
        <span className="text-[28px] font-extrabold leading-none text-[var(--bt-red)] tabular-nums">
          {rank}
        </span>
        {views && (
          <span className="mt-2 inline-flex items-center gap-1 h-[18px] px-2 rounded-full bg-[var(--bt-red)]/10 text-[var(--bt-red)] text-[10px] font-bold leading-none tabular-nums whitespace-nowrap">
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
            </svg>
            {views}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <ArticleCard post={post} variant="small" />
      </div>
    </li>
  );
}
