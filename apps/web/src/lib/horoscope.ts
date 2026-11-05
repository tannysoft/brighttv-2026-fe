// Horoscope data from the data API (apps/data → D1 `brighttv-horoscope`,
// written by scripts/horoscope/extract.ts):
// sections of evergreen articles by day of birth / zodiac, and "Pick a card"
// piles. The texts are the astrologers' own; every item links to its article.
import { unstable_cache } from "next/cache";
import { dataApi } from "./data-api";

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

export type ProfilePart = { html: string; title: string; path: string; author: string | null };
/** One topic (e.g. "นิสัย"), with a part per article that covers it. */
export type ProfileSection = { topic: string; parts: ProfilePart[] };
export type ProfileKind = "day" | "zodiac";

export const getProfile = safe(
  unstable_cache(
    async (kind: ProfileKind, key: string): Promise<ProfileSection[]> =>
      (await dataApi<ProfileSection[]>(`/horoscope/profile/${kind}/${encodeURIComponent(key)}`)) ?? [],
    ["horo-profile-v2"],
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

const cardIds = unstable_cache(
  async (): Promise<number[]> => (await dataApi<number[]>("/horoscope/cards")) ?? [],
  ["horo-card-ids"],
  { tags: ["horoscope"], revalidate: 86400 },
);

export const getCard = safe(
  unstable_cache(
    async (id: number): Promise<PickCard | null> => dataApi<PickCard>(`/horoscope/cards/${id}`),
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
