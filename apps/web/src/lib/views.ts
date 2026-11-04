// Page-view counter for the "most viewed" lists (replaces WordPress's
// seed-stat plugin). Article pages send a beacon to /api/views; counts are
// kept per hour in the web worker's D1 (`VIEWS_DB`), and the ranking covers
// the last 48 hours.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { unstable_cache } from "next/cache";

type D1 = {
  prepare: (sql: string) => {
    bind: (...v: unknown[]) => { run: () => Promise<unknown>; all: <T>() => Promise<{ results: T[] }> };
  };
};

async function db(): Promise<D1 | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as { VIEWS_DB?: D1 }).VIEWS_DB) ?? null;
  } catch {
    return null;
  }
}

const hour = () => Math.floor(Date.now() / 3_600_000);

export async function recordView(postId: number) {
  const d = await db();
  if (!d || !Number.isInteger(postId) || postId <= 0) return;
  await d
    .prepare(
      "INSERT INTO post_views (post_id, hour, views) VALUES (?1, ?2, 1) ON CONFLICT (post_id, hour) DO UPDATE SET views = views + 1",
    )
    .bind(postId, hour())
    .run();
  // Now and then, drop hours nobody ranks any more.
  if (Math.random() < 0.001) await d.prepare("DELETE FROM post_views WHERE hour < ?1").bind(hour() - 24 * 7).run();
}

/** Post ids by views over the last `hours`, most viewed first (cached 10 minutes). */
export const topViewedIds = unstable_cache(
  async (limit: number, hours = 48): Promise<number[]> => {
    const d = await db();
    if (!d) return [];
    try {
      const { results } = await d
        .prepare("SELECT post_id FROM post_views WHERE hour >= ?1 GROUP BY post_id ORDER BY SUM(views) DESC LIMIT ?2")
        .bind(hour() - hours, limit)
        .all<{ post_id: number }>();
      return results.map((r) => r.post_id);
    } catch {
      return [];
    }
  },
  ["top-viewed"],
  { revalidate: 600 },
);
