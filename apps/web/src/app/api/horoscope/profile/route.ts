import { getProfile, type ProfileKind } from "@/lib/horoscope";

const KEYS: Record<ProfileKind, string[]> = {
  day: ["sun", "mon", "tue", "wed", "wedn", "thu", "fri", "sat"],
  zodiac: ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"],
};

/** GET /api/horoscope/profile?kind=day&key=mon → that day's sections. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind") as ProfileKind;
  const key = sp.get("key") ?? "";
  if (!KEYS[kind]?.includes(key)) return Response.json({ error: "bad request" }, { status: 400 });
  const sections = await getProfile(kind, key);
  // Evergreen content: let the edge keep it for a day. (/api is otherwise no-store.)
  return Response.json({ sections }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
