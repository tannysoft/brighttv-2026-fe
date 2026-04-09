import type { WPPost } from "@/lib/wp";
import ArticleCard from "./ArticleCard";

// The 4-card grid that sits next to a hero image on the homepage, the
// crime full-width block, and the category landing pages.
//
// Mobile (below lg): 2×2 grid of STACKED feature cards (image on top, title
// below) so titles aren't squeezed into ~30px next to a 140px thumbnail.
//
// Desktop (lg+): 1×4 column of COMPACT side cards (image left, title right)
// sitting to the right of the hero — the compact layout works here because
// each row has the full sidebar width to breathe.
export default function HeroSideGrid({ posts }: { posts: WPPost[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
      {posts.map((p) => (
        <div key={p.id}>
          <div className="lg:hidden">
            <ArticleCard post={p} variant="feature" />
          </div>
          <div className="hidden lg:block">
            <ArticleCard post={p} variant="compact" />
          </div>
        </div>
      ))}
    </div>
  );
}
