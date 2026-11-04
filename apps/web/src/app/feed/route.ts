import { getPosts } from "@/lib/wp";
import { FEED_SIZE, rssResponse } from "@/lib/rss";

export const revalidate = 600;

/** Site-wide RSS feed: the latest stories. */
export async function GET() {
  const posts = await getPosts({ perPage: FEED_SIZE });
  return rssResponse({
    title: "BRIGHT TV",
    path: "/",
    description: "สำนักข่าวออนไลน์ ทันทุกสถานการณ์",
    posts,
  });
}
