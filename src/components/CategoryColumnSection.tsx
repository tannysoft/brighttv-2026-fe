import Image from "next/image";
import Link from "next/link";
import { getPosts, getFeaturedImage, getPostPath, stripHtml, timeAgoTH } from "@/lib/wp";
import ArticleCard from "./ArticleCard";
import SectionTitle from "./SectionTitle";
import { NavCategory } from "@/lib/categories";

const PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'><rect width='16' height='9' fill='%23eef3f7'/></svg>";

// Stacked layout for use inside multi-column grids:
// 1 large feature on top, 3 mini cards (image + small title) below.
export default async function CategoryColumnSection({
  category,
}: {
  category: NavCategory;
}) {
  const posts = await getPosts({ categories: category.id, perPage: 4 });
  if (!posts.length) return null;
  const [lead, ...rest] = posts;

  return (
    <section>
      <SectionTitle title={category.name} href={`/category/${category.slug}`} />
      <ArticleCard post={lead} variant="feature" />
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-5 pt-5 border-t border-[var(--bt-line)]">
        {rest.slice(0, 3).map((p) => {
          const img = getFeaturedImage(p, "medium");
          const title = stripHtml(p.title.rendered);
          return (
            <Link
              key={p.id}
              href={getPostPath(p)}
              className="group block"
            >
              <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-[var(--bt-navy-50)]">
                <Image
                  src={img?.url || PLACEHOLDER}
                  alt={img?.alt || title}
                  fill
                  sizes="(max-width: 640px) 33vw, 200px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                />
              </div>
              <h3 className="mt-2 text-[12px] sm:text-[13px] font-semibold leading-snug text-[var(--bt-text)] clamp-2 group-hover:text-[var(--bt-red)] transition-colors">
                {title}
              </h3>
              <p className="mt-1 text-[10px] text-[var(--bt-muted)]">{timeAgoTH(p.date)}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
