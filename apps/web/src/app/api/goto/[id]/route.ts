import { CMS_SOURCE } from "@/lib/env";
import { getPostPathById } from "@/lib/payload";

/** Old WordPress short links (/?p=123, rewritten here by next.config.ts) → the story's URL. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = CMS_SOURCE === "payload" ? await getPostPathById(Number(id)) : null;
  if (!path) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 301, headers: { location: path } });
}
