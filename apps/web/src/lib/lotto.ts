// Lottery results from the data API (apps/data → D1 `brighttv-lotto`, filled
// by the brighttv-lotto job in apps/lotto). The website never calls the GLO API itself. Cached under the
// "lotto" tag, which the job refreshes through /api/revalidate on new results.
import { unstable_cache } from "next/cache";
import { dataApi } from "./data-api";
import type { LottoDraw } from "./lotto-check";

// The cached readers throw when the API can't be read: unstable_cache doesn't
// store a throw, so an empty answer is never cached. The exported wrappers turn it into null / [].
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
    dataApi<LottoDraw>("/lotto/latest"),
  ["lotto-latest"],
  { tags: ["lotto"], revalidate: 3600 },
);
export const getLatestDraw = safe(latestCached, null);

const drawCached = unstable_cache(
  async (date: string): Promise<LottoDraw | null> =>
    dataApi<LottoDraw>(`/lotto/draws/${date}`),
  ["lotto-draw"],
  { tags: ["lotto"], revalidate: 86400 },
);
/** Draw held on `date` (YYYY-MM-DD). */
export const getDraw = safe(drawCached, null);

const datesCached = unstable_cache(
  async (): Promise<string[]> => (await dataApi<string[]>("/lotto/dates")) ?? [],
  ["lotto-dates"],
  { tags: ["lotto"], revalidate: 3600 },
);
/** Every draw date, newest first. */
export const getDrawDates = safe(datesCached, [] as string[]);
