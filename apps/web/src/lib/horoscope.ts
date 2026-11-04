// Horoscope data from D1 (`HORO_DB`, written by scripts/horoscope/extract.ts):
// sections of evergreen articles by day of birth / zodiac, and "Pick a card"
// piles. The texts are the astrologers' own; every item links to its article.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { unstable_cache } from "next/cache";

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
  const d = (env as unknown as { HORO_DB?: D1 }).HORO_DB;
  if (!d) throw new Error("HORO_DB binding missing");
  return d;
}

// Readers throw on failure (unstable_cache doesn't store a throw), callers get a fallback.
const safe =
  <A extends unknown[], T>(fn: (...a: A) => Promise<T>, fallback: T) =>
  async (...a: A): Promise<T> => {
    try {
      return await fn(...a);
    } catch {
      return fallback;
    }
  };

export type ProfileSection = { topic: string; html: string; title: string; path: string; author: string | null };
export type ProfileKind = "day" | "zodiac";

export const getProfile = safe(
  unstable_cache(
    async (kind: ProfileKind, key: string): Promise<ProfileSection[]> => {
      const { results } = await (await db())
        .prepare("SELECT topic, html, title, path, author FROM horo_profile WHERE kind = ?1 AND key = ?2 ORDER BY sort")
        .bind(kind, key)
        .all<ProfileSection>();
      return results;
    },
    ["horo-profile"],
    { tags: ["horoscope"], revalidate: 86400 },
  ),
  [] as ProfileSection[],
);

export type PickCard = {
  id: number;
  question: string;
  path: string;
  author: string | null;
  image: string | null;
  piles: Array<{ label: string; html: string }>;
};
type CardRow = Omit<PickCard, "piles"> & { piles: string };
const toCard = (r: CardRow | null): PickCard | null => (r ? { ...r, piles: JSON.parse(r.piles) } : null);

const cardIds = unstable_cache(
  async (): Promise<number[]> => {
    const { results } = await (await db()).prepare("SELECT id FROM horo_cards ORDER BY id").bind().all<{ id: number }>();
    return results.map((r) => r.id);
  },
  ["horo-card-ids"],
  { tags: ["horoscope"], revalidate: 86400 },
);

export const getCard = safe(
  unstable_cache(
    async (id: number): Promise<PickCard | null> =>
      toCard(
        await (await db())
          .prepare("SELECT id, question, path, author, image, piles FROM horo_cards WHERE id = ?1")
          .bind(id)
          .first<CardRow>(),
      ),
    ["horo-card"],
    { tags: ["horoscope"], revalidate: 86400 },
  ),
  null,
);

/** Today's question (changes daily, same for everyone), or a random other one. */
export const pickCardId = safe(async (mode: "today" | "random", not?: number): Promise<number | null> => {
  const ids = await cardIds();
  if (!ids.length) return null;
  if (mode === "today") {
    const day = Math.floor((Date.now() + 7 * 3_600_000) / 86_400_000); // Thai calendar day
    return ids[day % ids.length];
  }
  const others = ids.filter((id) => id !== not);
  return others[Math.floor(Math.random() * others.length)] ?? ids[0];
}, null);
