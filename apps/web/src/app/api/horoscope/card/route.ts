import { getCard, pickCardId } from "@/lib/horoscope";

/** GET /api/horoscope/card?not=123 → a random "Pick a card" question other than 123. */
export async function GET(req: Request) {
  const not = Number(new URL(req.url).searchParams.get("not")) || undefined;
  const id = await pickCardId("random", not);
  const card = id ? await getCard(id) : null;
  if (!card) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ card }, { headers: { "Cache-Control": "no-store" } });
}
