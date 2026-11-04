import { findWins } from "@/lib/lotto";

/** GET /api/lotto/check?n=123456 → every past draw this ticket would have won. */
export async function GET(req: Request) {
  const n = new URL(req.url).searchParams.get("n") ?? "";
  if (!/^\d{6}$/.test(n)) return Response.json({ error: "ต้องเป็นเลข 6 หลัก" }, { status: 400 });
  const wins = await findWins(n);
  return Response.json({ ticket: n, wins });
}
