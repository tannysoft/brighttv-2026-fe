import { getPosts } from "@/lib/wp";
import { FEED_SIZE, rssResponse } from "@/lib/rss";

export const revalidate = 600;

// No feeds are prebuilt; each is rendered on first request, then cached (ISR).
export async function generateStaticParams() {
  return [];
}

/** RSS feed of a tag's latest stories. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const posts = await getPosts({ tagSlug: slug, perPage: FEED_SIZE });
  if (!posts.length) return new Response("Not found", { status: 404 });
  let name = slug;
  try {
    name = decodeURIComponent(slug);
  } catch {
    // keep as is
  }
  return rssResponse({
    title: `${name} – BRIGHT TV`,
    // WordPress-style lowercase percent-encoding.
    path: `/tag/${encodeURIComponent(name).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase())}`,
    description: `ข่าวที่ติดแท็ก ${name} จาก BRIGHT TV`,
    posts,
  });
}
