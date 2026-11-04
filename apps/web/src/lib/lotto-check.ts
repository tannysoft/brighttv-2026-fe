// Lottery draw shape (as stored in D1 by apps/lotto) and pure helpers used by
// both server pages and the client-side checker. No server imports here.

export type LottoPrize = {
  id: string;
  name: string;
  /** Baht per ticket ("6000000"). */
  reward: string;
  amount: number;
  number: string[];
};

export type LottoDraw = {
  /** YYYY-MM-DD (Gregorian) */
  date: string;
  prizes: LottoPrize[];
  runningNumbers: LottoPrize[];
  youtube?: string | null;
  pdf?: string | null;
};

export type TicketWin = { name: string; reward: number };

/** "2026-11-01" → "01-11-2569" (URL slug, same as the old WordPress lottery posts). */
export function drawSlug(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${Number(y) + 543}`;
}

/** "01-11-2569" → "2026-11-01", or null when it isn't a date slug. */
export function parseDrawSlug(slug: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(slug);
  if (!m) return null;
  const y = Number(m[3]) - 543;
  const iso = `${y}-${m[2]}-${m[1]}`;
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
}

/** "2026-11-01" → "1 พฤศจิกายน 2569" */
export function thaiDate(iso: string, month: "long" | "short" = "long"): string {
  return new Date(`${iso}T00:00:00+07:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month,
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

export const prize = (draw: LottoDraw | null, id: string): string[] =>
  [...(draw?.prizes ?? []), ...(draw?.runningNumbers ?? [])].find((p) => p.id === id)?.number ?? [];

export const rewardOf = (draw: LottoDraw | null, id: string): number =>
  Number([...(draw?.prizes ?? []), ...(draw?.runningNumbers ?? [])].find((p) => p.id === id)?.reward ?? 0);

const WHOLE = ["prizeFirst", "prizeFirstNear", "prizeSecond", "prizeThird", "prizeForth", "prizeFifth"];

/** Prizes a 6-digit ticket wins in `draw` (empty when none). */
export function checkTicket(draw: LottoDraw, ticket: string): TicketWin[] {
  const all = [...draw.prizes, ...draw.runningNumbers];
  const wins: TicketWin[] = [];
  for (const p of all) {
    const part =
      p.id === "runningNumberFrontThree"
        ? ticket.slice(0, 3)
        : p.id === "runningNumberBackThree"
          ? ticket.slice(-3)
          : p.id === "runningNumberBackTwo"
            ? ticket.slice(-2)
            : WHOLE.includes(p.id)
              ? ticket
              : null;
    if (part && p.number.includes(part)) wins.push({ name: p.name, reward: Number(p.reward) });
  }
  return wins;
}
