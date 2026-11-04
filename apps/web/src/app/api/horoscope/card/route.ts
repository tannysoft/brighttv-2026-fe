import { getCard, pickCardId } from "@/lib/horoscope";

/**
 * GET /api/horoscope/card?today=1 → today's question;
 * GET /api/horoscope/card?not=123 → a random one other than 123.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const not = Number(sp.get("not")) || undefined;
  const id = await pickCardId(sp.get("today") ? "today" : "random", not);
  const card = id ? await getCard(id) : null;
  if (!card) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ card }, { headers: { "Cache-Control": "no-store" } });
}
