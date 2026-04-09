import Image from "next/image";
import Link from "next/link";
import type { WPPost } from "@/lib/wp";
import {
  getFeaturedImage,
  getPostPath,
  getPrimaryCategory,
  hasVideo,
  stripHtml,
  timeAgoTH,
} from "@/lib/utils";
import ArticleCard from "./ArticleCard";
import PlayBadge from "./PlayBadge";

// The 4-card grid that sits next to a hero image on the homepage, the
// crime full-width block, and the category landing pages.
//
// Mobile (below lg): 2×2 grid of STACKED feature cards (image on top, title
// below) so titles aren't squeezed into ~30px next to a 140px thumbnail.
//
// Desktop (lg+): 1×4 flex-col of side cards with a custom layout where the
// image spans the card's FULL height (not a fixed 160×90 box), so the four
// cards line up edge-to-edge with no vertical gaps inside each row. The
// column uses `lg:h-full` + `lg:flex-1` per card so the total height matches
// the hero image on the left and the four cards divide that space evenly.
export default function HeroSideGrid({ posts }: { posts: WPPost[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:flex lg:flex-col lg:gap-4 lg:h-full">
      {posts.map((p) => (
        <div key={p.id} className="lg:flex-1 lg:min-h-0">
          {/* Mobile: stacked feature card (image on top, title below) */}
          <div className="lg:hidden">
            <ArticleCard post={p} variant="feature" />
          </div>
          {/* Desktop: side card with image filling full row height */}
          <div className="hidden lg:block lg:h-full">
            <DesktopSideCard post={p} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Desktop-only card used inside HeroSideGrid. Image takes the card's full
// vertical height (width computed from a 16:9 aspect), title column fills
// the rest. This way four of these stacked in a flex-col fill the hero's
// height exactly with no dead space inside each row.
function DesktopSideCard({ post }: { post: WPPost }) {
  const img = getFeaturedImage(post, "large");
  const cat = getPrimaryCategory(post);
  const title = stripHtml(post.title.rendered);
  const href = getPostPath(post);
  const showPlay = hasVideo(post);
  return (
    <Link href={href} className="group flex h-full gap-3 items-stretch">
      <div className="relative h-full aspect-[16/9] shrink-0 overflow-hidden rounded-lg bg-[var(--bt-navy-50)]">
        <Image
          src={img.url}
          alt={img.alt}
          fill
          sizes="200px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
        {showPlay && <PlayBadge size="sm" />}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {cat && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--bt-red)] leading-none">
            {cat.name}
          </span>
        )}
        <h3 className="mt-1 text-[13px] sm:text-[14px] font-bold leading-snug text-[var(--bt-text)] clamp-2 group-hover:text-[var(--bt-red)] transition-colors">
          {title}
        </h3>
        <p className="mt-1 text-[10px] text-[var(--bt-muted)] leading-none">
          {timeAgoTH(post.date)}
        </p>
      </div>
    </Link>
  );
}
