import { getPosts, getUserBySlug } from "@/lib/wp";
import { FEED_SIZE, rssResponse } from "@/lib/rss";

export const revalidate = 600;

// No feeds are prebuilt; each is rendered on first request, then cached (ISR).
export async function generateStaticParams() {
  return [];
}

/** RSS feed of an author's latest stories (/author/{slug}/feed, as on WordPress). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getUserBySlug(slug);
  if (!user) return new Response("Not found", { status: 404 });
  const posts = await getPosts({ author: user.id, perPage: FEED_SIZE });
  let path = slug;
  try {
    path = decodeURIComponent(slug);
  } catch {
    // keep as is
  }
  return rssResponse({
    title: `${user.name} – BRIGHT TV`,
    path: `/author/${encodeURIComponent(path).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase())}`,
    description: `บทความล่าสุดจาก ${user.name} บน BRIGHT TV`,
    posts,
  });
}
