// Lottery results from D1 (`LOTTO_DB`, filled by the brighttv-lotto job in
// apps/lotto). The website never calls the GLO API itself. Cached under the
// "lotto" tag, which the job refreshes through /api/revalidate on new results.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { unstable_cache } from "next/cache";
import { checkTicket, type LottoDraw, type TicketWin } from "./lotto-check";

type D1 = {
  prepare: (sql: string) => {
    bind: (...v: unknown[]) => {
      first: <T>() => Promise<T | null>;
      all: <T>() => Promise<{ results: T[] }>;
    };
  };
};

async function db(): Promise<D1> {
  const { env } = await getCloudflareContext({ async: true });
  const d = (env as unknown as { LOTTO_DB?: D1 }).LOTTO_DB;
  if (!d) throw new Error("LOTTO_DB binding missing");
  return d;
}

const parse = (row: { data: string } | null): LottoDraw | null => (row ? (JSON.parse(row.data) as LottoDraw) : null);

// The cached readers throw when D1 can't be read (e.g. during `next build`,
// where the table doesn't exist): unstable_cache doesn't store a throw, so an
// empty answer is never cached. The exported wrappers turn it into null / [].
const safe =
  <A extends unknown[], T>(fn: (...a: A) => Promise<T>, fallback: T) =>
  async (...a: A): Promise<T> => {
    try {
      return await fn(...a);
    } catch {
      return fallback;
    }
  };

const latestCached = unstable_cache(
  async (): Promise<LottoDraw | null> =>
    parse(await (await db()).prepare("SELECT data FROM lotto_draws ORDER BY date DESC LIMIT 1").bind().first<{ data: string }>()),
  ["lotto-latest"],
  { tags: ["lotto"], revalidate: 3600 },
);
export const getLatestDraw = safe(latestCached, null);

const drawCached = unstable_cache(
  async (date: string): Promise<LottoDraw | null> =>
    parse(await (await db()).prepare("SELECT data FROM lotto_draws WHERE date = ?1").bind(date).first<{ data: string }>()),
  ["lotto-draw"],
  { tags: ["lotto"], revalidate: 86400 },
);
/** Draw held on `date` (YYYY-MM-DD). */
export const getDraw = safe(drawCached, null);

const datesCached = unstable_cache(
  async (): Promise<string[]> => {
    const res = await (await db()).prepare("SELECT date FROM lotto_draws ORDER BY date DESC").bind().all<{ date: string }>();
    return res.results.map((r) => r.date);
  },
  ["lotto-dates"],
  { tags: ["lotto"], revalidate: 3600 },
);
/** Every draw date, newest first. */
export const getDrawDates = safe(datesCached, [] as string[]);

export type HistoryWin = { date: string; wins: TicketWin[]; total: number };

/** Every past draw a 6-digit ticket would have won, newest first. */
export async function findWins(ticket: string): Promise<HistoryWin[]> {
  if (!/^\d{6}$/.test(ticket)) return [];
  const d = await db().catch(() => null);
  if (!d) return [];
  // Narrow in SQL (numbers are stored as JSON strings), then check exactly.
  const parts = [ticket, ticket.slice(0, 3), ticket.slice(-3), ticket.slice(-2)].map((p) => `%"${p}"%`);
  const { results } = await d
    .prepare("SELECT data FROM lotto_draws WHERE data LIKE ?1 OR data LIKE ?2 OR data LIKE ?3 OR data LIKE ?4 ORDER BY date DESC")
    .bind(...parts)
    .all<{ data: string }>();
  const out: HistoryWin[] = [];
  for (const row of results) {
    let draw: LottoDraw | null = null;
    try {
      draw = parse(row);
    } catch {
      continue;
    }
    if (!draw) continue;
    const wins = checkTicket(draw, ticket);
    if (wins.length) out.push({ date: draw.date, wins, total: wins.reduce((s, w) => s + w.reward, 0) });
  }
  return out;
}
