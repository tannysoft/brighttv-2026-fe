import Image from "next/image";
import Link from "next/link";
import type { WPPost } from "@/lib/wp";
import {
  formatViews,
  getFeaturedImage,
  getPostPath,
  getPrimaryCategory,
  hasVideo,
  stripHtml,
  timeAgoTH,
} from "@/lib/utils";
import PlayBadge from "./PlayBadge";

type Variant = "hero" | "feature" | "list" | "compact" | "small";

const PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'><rect width='16' height='9' fill='%23eef3f7'/></svg>";

export default function ArticleCard({
  post,
  variant = "list",
  priority = false,
}: {
  post: WPPost;
  variant?: Variant;
  priority?: boolean;
}) {
  const img = getFeaturedImage(post, variant === "hero" ? "full" : "large");
  const cat = getPrimaryCategory(post);
  const title = stripHtml(post.title.rendered);
  const excerpt = stripHtml(post.excerpt.rendered);
  const href = getPostPath(post);
  const showPlay = hasVideo(post);
  const viewsLabel = formatViews(post.views);

  if (variant === "hero") {
    return (
      <Link href={href} className="group relative block overflow-hidden rounded-2xl">
        <div className="relative aspect-[16/9] bg-[var(--bt-navy-50)]">
          <Image
            src={img?.url || PLACEHOLDER}
            alt={img?.alt || title}
            fill
            sizes="(max-width: 1024px) 100vw, 800px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            priority={priority}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          {showPlay && <PlayBadge size="lg" />}
        </div>
        <div className="absolute left-0 right-0 bottom-0 p-5 sm:p-7 text-white">
          {cat && (
            <span className="inline-block mb-3 px-3 py-1 rounded-full bg-[var(--bt-red)] !text-white text-[11px] font-bold uppercase tracking-wider">
              {cat.name}
            </span>
          )}
          <h2 className="text-xl sm:text-3xl font-extrabold leading-snug clamp-3 group-hover:text-[#ffd6d8] transition-colors">
            {title}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-white/80">{timeAgoTH(post.date)}</p>
        </div>
      </Link>
    );
  }

  if (variant === "feature") {
    return (
      <Link href={href} className="group block">
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[var(--bt-navy-50)]">
          <Image
            src={img?.url || PLACEHOLDER}
            alt={img?.alt || title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          {showPlay && <PlayBadge size="md" />}
        </div>
        <h3 className="mt-3 text-base sm:text-lg font-bold leading-snug text-[var(--bt-text)] clamp-2 group-hover:text-[var(--bt-red)] transition-colors">
          {title}
        </h3>
        <p className="mt-1.5 text-xs text-[var(--bt-muted)]">{timeAgoTH(post.date)}</p>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href={href} className="group flex gap-3 items-stretch">
        <div className="relative w-[140px] sm:w-[160px] aspect-[16/9] shrink-0 overflow-hidden rounded-lg bg-[var(--bt-navy-50)]">
          <Image
            src={img?.url || PLACEHOLDER}
            alt={img?.alt || title}
            fill
            sizes="160px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
          {showPlay && <PlayBadge size="sm" />}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {(cat || viewsLabel) && (
            <div className="flex items-center justify-between gap-2">
              {cat ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--bt-red)] leading-none">
                  {cat.name}
                </span>
              ) : (
                <span />
              )}
              {viewsLabel && <ViewsBadge label={viewsLabel} />}
            </div>
          )}
          <h3 className="mt-1 text-[13px] sm:text-[14px] font-bold leading-snug text-[var(--bt-text)] clamp-2 group-hover:text-[var(--bt-red)] transition-colors">
            {title}
          </h3>
          {!viewsLabel && (
            <p className="mt-1 text-[10px] text-[var(--bt-muted)] leading-none">
              {timeAgoTH(post.date)}
            </p>
          )}
        </div>
      </Link>
    );
  }

  if (variant === "small") {
    // Views for the mostview/popular sidebars are rendered by the caller next
    // to the rank number, so this variant stays minimal: title + date.
    return (
      <Link href={href} className="group block">
        <h4 className="text-[14px] font-semibold leading-snug text-[var(--bt-text)] clamp-2 group-hover:text-[var(--bt-red)] transition-colors">
          {title}
        </h4>
        <p className="mt-1 text-[11px] text-[var(--bt-muted)]">
          {timeAgoTH(post.date)}
        </p>
      </Link>
    );
  }

  // list (default)
  return (
    <Link href={href} className="group flex gap-4 items-start py-4 border-b border-[var(--bt-line)] last:border-0">
      <div className="relative w-[140px] sm:w-[180px] aspect-[16/9] shrink-0 overflow-hidden rounded-lg bg-[var(--bt-navy-50)]">
        <Image
          src={img?.url || PLACEHOLDER}
          alt={img?.alt || title}
          fill
          sizes="180px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
        {showPlay && <PlayBadge size="sm" />}
      </div>
      <div className="flex-1 min-w-0">
        {cat && (
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[var(--bt-red)]">
            {cat.name}
          </span>
        )}
        <h3 className="mt-1 text-base sm:text-lg font-bold leading-snug text-[var(--bt-text)] clamp-2 group-hover:text-[var(--bt-red)] transition-colors">
          {title}
        </h3>
        {excerpt && (
          <p className="hidden sm:block mt-1.5 text-sm text-[var(--bt-muted)] clamp-2">{excerpt}</p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--bt-muted)]">
          {viewsLabel ? (
            <ViewsBadge label={viewsLabel} />
          ) : (
            <span>{timeAgoTH(post.date)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// Red-tinted pill used by the mostview / popular sidebars. Flame icon +
// full thousands-separated count so the number reads as weighty trending
// evidence rather than a fine-print footnote next to the date.
function ViewsBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[var(--bt-red)]/10 text-[var(--bt-red)] text-[10px] font-bold leading-none">
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
      </svg>
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
