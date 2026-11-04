import { recordView } from "@/lib/views";

/** Page-view beacon from article pages (components/ViewBeacon.tsx). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = Number(body?.id);
  if (Number.isInteger(id) && id > 0) await recordView(id).catch(() => {});
  return new Response(null, { status: 204 });
}
