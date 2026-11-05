/**
 * GET-only JSON API (see wrangler.jsonc):
 *
 *   /lotto/latest                 newest draw
 *   /lotto/dates                  every draw date (YYYY-MM-DD), newest first
 *   /lotto/draws/{YYYY-MM-DD}     one draw
 *   /horoscope/profile/{day|zodiac}/{key}   sections grouped by topic
 *   /horoscope/cards              Pick a card ids
 *   /horoscope/cards/{id}         one Pick a card question
 *
 * 404 = not found. The website caches every answer and refreshes by tag.
 */
type Env = { LOTTO_DB: D1Database; HORO_DB: D1Database };

type ProfilePart = { html: string; title: string; path: string; author: string | null };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" },
  });
const notFound = () => json({ error: "not found" }, 404);

async function lotto(db: D1Database, parts: string[]): Promise<Response> {
  const [what, arg] = parts;
  if (what === "latest" && !arg) {
    const row = await db.prepare("SELECT data FROM lotto_draws ORDER BY date DESC LIMIT 1").first<{ data: string }>();
    return row ? new Response(row.data, { headers: { "content-type": "application/json; charset=utf-8" } }) : notFound();
  }
  if (what === "dates" && !arg) {
    const { results } = await db.prepare("SELECT date FROM lotto_draws ORDER BY date DESC").all<{ date: string }>();
    return json(results.map((r) => r.date));
  }
  if (what === "draws" && arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
    const row = await db.prepare("SELECT data FROM lotto_draws WHERE date = ?1").bind(arg).first<{ data: string }>();
    return row ? new Response(row.data, { headers: { "content-type": "application/json; charset=utf-8" } }) : notFound();
  }
  return notFound();
}

async function horoscope(db: D1Database, parts: string[]): Promise<Response> {
  const [what, a, b] = parts;
  if (what === "profile" && (a === "day" || a === "zodiac") && b && parts.length === 3) {
    const { results } = await db
      .prepare("SELECT topic, html, title, path, author FROM horo_profile WHERE kind = ?1 AND key = ?2 ORDER BY sort")
      .bind(a, b)
      .all<ProfilePart & { topic: string }>();
    // Same topic from several articles → one section, in article order.
    const byTopic = new Map<string, ProfilePart[]>();
    for (const { topic, ...part } of results) byTopic.set(topic, [...(byTopic.get(topic) ?? []), part]);
    return json([...byTopic].map(([topic, parts]) => ({ topic, parts })));
  }
  if (what === "cards" && !a) {
    const { results } = await db.prepare("SELECT id FROM horo_cards ORDER BY id").all<{ id: number }>();
    return json(results.map((r) => r.id));
  }
  if (what === "cards" && a && /^\d+$/.test(a) && !b) {
    const row = await db
      .prepare("SELECT id, question, path, author, image, piles FROM horo_cards WHERE id = ?1")
      .bind(Number(a))
      .first<{ piles: string }>();
    return row ? json({ ...row, piles: JSON.parse(row.piles) }) : notFound();
  }
  return notFound();
}

export default {
  async fetch(req, env) {
    if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "method not allowed" }, 405);
    const [area, ...parts] = new URL(req.url).pathname.split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (area === "lotto") return await lotto(env.LOTTO_DB, parts);
      if (area === "horoscope") return await horoscope(env.HORO_DB, parts);
      return notFound();
    } catch (err) {
      console.error(`data api ${req.url}: ${(err as Error).message}`);
      return json({ error: "unavailable" }, 503);
    }
  },
} satisfies ExportedHandler<Env>;
