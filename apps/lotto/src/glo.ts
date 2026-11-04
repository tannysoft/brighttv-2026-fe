/**
 * Government Lottery Office (glo.or.th) API → the draw shape stored in D1.
 * Shared by the scheduled job (src/index.ts) and the backfill script.
 */
export type LottoPrize = {
  id: string;
  name: string;
  /** Baht per ticket, as a string ("6000000"). */
  reward: string;
  amount: number;
  number: string[];
};

export type LottoDraw = {
  /** YYYY-MM-DD */
  date: string;
  prizes: LottoPrize[];
  runningNumbers: LottoPrize[];
  youtube: string | null;
  pdf: string | null;
};

const API = "https://www.glo.or.th/api/lottery";

type GloPrize = { price: string; number: Array<{ value: string }> };
type GloResponse = {
  status?: boolean;
  response?: {
    date?: string;
    youtube_url?: string | null;
    pdf_url?: string | null;
    data?: Record<string, GloPrize>;
  } | null;
};

// GLO key → our id/name (ids match the old lottery API the pages were built on).
const PRIZES: Array<[key: string, id: string, name: string, running: boolean]> = [
  ["first", "prizeFirst", "รางวัลที่ 1", false],
  ["near1", "prizeFirstNear", "รางวัลข้างเคียงรางวัลที่ 1", false],
  ["second", "prizeSecond", "รางวัลที่ 2", false],
  ["third", "prizeThird", "รางวัลที่ 3", false],
  ["fourth", "prizeForth", "รางวัลที่ 4", false],
  ["fifth", "prizeFifth", "รางวัลที่ 5", false],
  ["last3f", "runningNumberFrontThree", "เลขหน้า 3 ตัว", true],
  ["last3b", "runningNumberBackThree", "เลขท้าย 3 ตัว", true],
  ["last2", "runningNumberBackTwo", "เลขท้าย 2 ตัว", true],
];

async function call(path: string, body: unknown): Promise<LottoDraw | null> {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GLO ${path}: HTTP ${res.status}`);
  return normalize((await res.json()) as GloResponse);
}

/** The latest draw (may be partial while the draw is still running). */
export const fetchLatest = () => call("getLatestLottery", {});

/** The draw held on `date` (YYYY-MM-DD), or null when there was none that day. */
export function fetchByDate(date: string) {
  const [year, month, day] = date.split("-");
  return call("getLotteryAward", { date: day, month, year });
}

export function normalize(json: GloResponse): LottoDraw | null {
  const r = json.response;
  if (!json.status || !r?.date || !r.data) return null;
  const draw: LottoDraw = {
    date: r.date.slice(0, 10),
    prizes: [],
    runningNumbers: [],
    youtube: r.youtube_url || null,
    pdf: r.pdf_url || null,
  };
  for (const [key, id, name, running] of PRIZES) {
    const p = r.data[key];
    if (!p) continue;
    const number = p.number.map((n) => n.value).filter(Boolean).sort();
    if (!number.length) continue;
    const reward = String(Math.round(Number(p.price) || 0));
    (running ? draw.runningNumbers : draw.prizes).push({ id, name, reward, amount: number.length, number });
  }
  // Nothing drawn yet.
  return draw.prizes.some((p) => p.id === "prizeFirst") ? draw : null;
}
