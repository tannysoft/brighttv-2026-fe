import { getCategoryBySlug, getPosts } from "@/lib/wp";
import { stripHtml } from "@/lib/utils";
import { FEED_SIZE, rssResponse } from "@/lib/rss";

export const revalidate = 600;

// No feeds are prebuilt; each is rendered on first request, then cached (ISR).
export async function generateStaticParams() {
  return [];
}

/** RSS feed of a category's latest stories. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return new Response("Not found", { status: 404 });
  const posts = await getPosts({ categories: cat.id, perPage: FEED_SIZE });
  const name = stripHtml(cat.name);
  return rssResponse({
    title: `${name} – BRIGHT TV`,
    path: `/category/${cat.slug}`,
    description: stripHtml(cat.description) || `ข่าว${name}ล่าสุดจาก BRIGHT TV`,
    posts,
  });
}
