import { getPosts, getTagBySlug } from "@/lib/wp";
import { stripHtml } from "@/lib/utils";
import { FEED_SIZE, rssResponse } from "@/lib/rss";
import { tagPath } from "../path";

export const revalidate = 600;

// No feeds are prebuilt; each is rendered on first request, then cached (ISR).
export async function generateStaticParams() {
  return [];
}

/** RSS feed of a tag's latest stories (404 for an unknown or empty tag). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag || !tag.count) return new Response("Not found", { status: 404 });
  // By id, and only stories that carry the tag (see getTagBySlug).
  const name = stripHtml(tag.name);
  const posts = (await getPosts({ tags: tag.id, perPage: FEED_SIZE })).filter((p) => p.tags?.includes(tag.id));
  if (!posts.length) return new Response("Not found", { status: 404 });
  return rssResponse({
    title: `${name} – BRIGHT TV`,
    path: tagPath(slug),
    description: `ข่าวที่ติดแท็ก ${name} จาก BRIGHT TV`,
    posts,
  });
}
