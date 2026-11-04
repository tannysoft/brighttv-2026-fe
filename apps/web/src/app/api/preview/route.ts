import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { CMS_URL } from "@/lib/env";

/**
 * Entry point for the CMS "Preview" button:
 * /api/preview?secret=…&id={postId}. Turns on draft mode and opens the story
 * (the article page then reads the latest draft with CMS_PREVIEW_API_KEY).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.PREVIEW_SECRET;
  const id = Number(url.searchParams.get("id"));
  if (!secret || url.searchParams.get("secret") !== secret || !Number.isInteger(id) || id <= 0) {
    return new Response("Invalid preview link", { status: 401 });
  }
  // The slug may only exist on the draft, so look it up with the preview key.
  const key = process.env.CMS_PREVIEW_API_KEY;
  const res = key
    ? await fetch(`${CMS_URL}/api/posts/${id}?draft=true&depth=0&select[slug]=true`, {
        cache: "no-store",
        headers: { authorization: `users API-Key ${key}` },
      })
    : null;
  const slug = res?.ok ? ((await res.json()) as { slug?: string }).slug : null;
  if (!slug) return new Response("Story not found (is CMS_PREVIEW_API_KEY set?)", { status: 404 });
  (await draftMode()).enable();
  redirect(`/news/${encodeURIComponent(slug)}`);
}
