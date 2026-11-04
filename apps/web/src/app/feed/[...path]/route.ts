import { getCategoryBySlug, getPosts } from "@/lib/wp";
import { stripHtml } from "@/lib/utils";
import { categoryPath } from "@/lib/categories";
import { FEED_SIZE, rssResponse } from "@/lib/rss";

export const revalidate = 600;

// No feeds are prebuilt; each is rendered on first request, then cached (ISR).
export async function generateStaticParams() {
  return [];
}

/** RSS of a category's latest stories: /feed/news/politics (old /category/…/feed redirects here). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const cat = await getCategoryBySlug(path[path.length - 1]);
  if (!cat) return new Response("Not found", { status: 404 });
  const posts = await getPosts({ categories: cat.id, perPage: FEED_SIZE });
  const name = stripHtml(cat.name);
  return rssResponse({
    title: `${name} – BRIGHT TV`,
    path: categoryPath(cat.slug),
    description: stripHtml(cat.description) || `ข่าว${name}ล่าสุดจาก BRIGHT TV`,
    posts,
  });
}
