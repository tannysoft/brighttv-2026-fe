import { getPosts } from "@/lib/wp";
import ArticleCard from "./ArticleCard";
import SectionTitle from "./SectionTitle";
import { NavCategory } from "@/lib/categories";

export default async function CategorySection({ category }: { category: NavCategory }) {
  const posts = await getPosts({ categories: category.id, perPage: 4 });
  if (!posts.length) return null;
  const [lead, ...rest] = posts;

  return (
    <section className="mb-12">
      <SectionTitle title={category.name} href={`/category/${category.slug}`} />
      <div className="grid gap-6 md:grid-cols-2">
        <ArticleCard post={lead} variant="feature" />
        <div className="space-y-4">
          {rest.slice(0, 3).map((p) => (
            <ArticleCard key={p.id} post={p} variant="compact" />
          ))}
        </div>
      </div>
    </section>
  );
}
