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

async function db(): Promise<D1 | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as { LOTTO_DB?: D1 }).LOTTO_DB ?? null;
  } catch {
    return null;
  }
}

const parse = (row: { data: string } | null): LottoDraw | null => {
  try {
    return row ? (JSON.parse(row.data) as LottoDraw) : null;
  } catch {
    return null;
  }
};

export const getLatestDraw = unstable_cache(
  async (): Promise<LottoDraw | null> =>
    parse((await (await db())?.prepare("SELECT data FROM lotto_draws ORDER BY date DESC LIMIT 1").bind().first<{ data: string }>()) ?? null),
  ["lotto-latest"],
  { tags: ["lotto"], revalidate: 3600 },
);

/** Draw held on `date` (YYYY-MM-DD). */
export const getDraw = unstable_cache(
  async (date: string): Promise<LottoDraw | null> =>
    parse((await (await db())?.prepare("SELECT data FROM lotto_draws WHERE date = ?1").bind(date).first<{ data: string }>()) ?? null),
  ["lotto-draw"],
  { tags: ["lotto"], revalidate: 86400 },
);

/** Every draw date, newest first. */
export const getDrawDates = unstable_cache(
  async (): Promise<string[]> => {
    const res = await (await db())?.prepare("SELECT date FROM lotto_draws ORDER BY date DESC").bind().all<{ date: string }>();
    return res?.results.map((r) => r.date) ?? [];
  },
  ["lotto-dates"],
  { tags: ["lotto"], revalidate: 3600 },
);

export type HistoryWin = { date: string; wins: TicketWin[]; total: number };

/** Every past draw a 6-digit ticket would have won, newest first. */
export async function findWins(ticket: string): Promise<HistoryWin[]> {
  if (!/^\d{6}$/.test(ticket)) return [];
  const d = await db();
  if (!d) return [];
  // Narrow in SQL (numbers are stored as JSON strings), then check exactly.
  const parts = [ticket, ticket.slice(0, 3), ticket.slice(-3), ticket.slice(-2)].map((p) => `%"${p}"%`);
  const { results } = await d
    .prepare("SELECT data FROM lotto_draws WHERE data LIKE ?1 OR data LIKE ?2 OR data LIKE ?3 OR data LIKE ?4 ORDER BY date DESC")
    .bind(...parts)
    .all<{ data: string }>();
  const out: HistoryWin[] = [];
  for (const row of results) {
    const draw = parse(row);
    if (!draw) continue;
    const wins = checkTicket(draw, ticket);
    if (wins.length) out.push({ date: draw.date, wins, total: wins.reduce((s, w) => s + w.reward, 0) });
  }
  return out;
}
