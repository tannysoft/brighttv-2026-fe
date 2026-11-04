/**
 * Scheduled job: store the latest GLO draw in D1 and refresh the website's
 * lottery pages when it is new or changed (results fill in during the draw).
 */
import { fetchLatest, type LottoDraw } from "./glo.ts";

type Env = {
  LOTTO_DB: D1Database;
  WEB_URL: string;
  REVALIDATE_SECRET?: string;
};

export async function saveDraw(db: D1Database, draw: LottoDraw): Promise<boolean> {
  const data = JSON.stringify(draw);
  // Writes only when the row is new or its data changed.
  const res = await db
    .prepare(
      `INSERT INTO lotto_draws (date, data, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (date) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
       WHERE lotto_draws.data <> excluded.data`,
    )
    .bind(draw.date, data, Date.now())
    .run();
  return (res.meta.changes ?? 0) > 0;
}

async function revalidate(env: Env, draw: LottoDraw) {
  if (!env.REVALIDATE_SECRET) {
    console.warn("REVALIDATE_SECRET not set; website keeps its cache until it expires");
    return;
  }
  const res = await fetch(`${env.WEB_URL}/api/revalidate`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.REVALIDATE_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ tags: ["lotto", `lotto-${draw.date}`] }),
  });
  if (!res.ok) console.error(`revalidate failed: HTTP ${res.status}`);
}

export async function sync(env: Env): Promise<string> {
  const draw = await fetchLatest();
  if (!draw) return "no draw";
  const changed = await saveDraw(env.LOTTO_DB, draw);
  if (changed) await revalidate(env, draw);
  return `${draw.date} ${changed ? "saved" : "unchanged"}`;
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      sync(env).then(
        (msg) => console.log(`lotto sync: ${msg}`),
        (err) => console.error(`lotto sync failed: ${(err as Error).message}`),
      ),
    );
  },
  // No public endpoints.
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
