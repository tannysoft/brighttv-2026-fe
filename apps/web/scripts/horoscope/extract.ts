/**
 * Horoscope articles → D1 (`brighttv-horoscope`), for the /horoscope page:
 *   - horo_profile: per day-of-birth / zodiac sections of hand-picked,
 *     evergreen articles (personality, lucky numbers, colours, …)
 *   - horo_cards:   every "Pick a card" article split into its piles
 *
 *   node scripts/horoscope/extract.ts [--local] [--dry]
 *
 * Reads WordPress REST (later: point WP at the CMS export). Re-runnable:
 * tables are rebuilt each run. The texts are the astrologers' own, with a
 * link back to each article.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const WP = "https://www.brighttv.co.th/wp-json/wp/v2";
const HEADERS = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "application/json",
};
const local = process.argv.includes("--local");
const dry = process.argv.includes("--dry");

/** Evergreen articles with one section per day of birth / zodiac, and the topic shown for them. */
const PROFILE_SOURCES: Array<{ id: number; kind: "day" | "zodiac"; topic: string }> = [
  { id: 1375311, kind: "day", topic: "นิสัย" },
  { id: 1317328, kind: "day", topic: "นิสัย" },
  { id: 1389924, kind: "day", topic: "คติประจำตัว" },
  { id: 1143753, kind: "day", topic: "พื้นดวงชะตา" },
  { id: 1377923, kind: "day", topic: "ดวงศาสตร์พม่า" },
  { id: 1742609, kind: "day", topic: "เลขมงคล" },
  { id: 1295277, kind: "day", topic: "เลขกาลกิณี" },
  { id: 1596175, kind: "day", topic: "สีเสริมดวง" },
  { id: 1250083, kind: "day", topic: "สีเสริมเสน่ห์" },
  { id: 1587870, kind: "day", topic: "คู่แท้" },
  { id: 1640590, kind: "day", topic: "บูชาเสริมดวง" },
  { id: 1124268, kind: "day", topic: "พระประจำวันเกิด" },
  { id: 1639795, kind: "day", topic: "ควรทำ ไม่ควรทำ" },
  { id: 1261587, kind: "day", topic: "ทำบุญวันเกิด" },
  { id: 1703771, kind: "day", topic: "สัตว์เลี้ยงเสริมดวง" },
  { id: 1707712, kind: "zodiac", topic: "นิสัย" },
  { id: 1631830, kind: "zodiac", topic: "จุดอ่อน จุดแข็ง" },
  { id: 1483610, kind: "zodiac", topic: "ธาตุประจำราศี" },
  { id: 1232640, kind: "zodiac", topic: "เนื้อคู่" },
  { id: 1215280, kind: "zodiac", topic: "สีมงคลในบ้าน" },
];

const DAY_KEYS: Array<[RegExp, string]> = [
  [/พุธ.{0,6}(กลางคืน|ราหู)/, "wedn"],
  [/อาทิตย์/, "sun"],
  [/จันทร์/, "mon"],
  [/อังคาร/, "tue"],
  [/พุธ/, "wed"],
  [/พฤหัส/, "thu"],
  [/ศุกร์/, "fri"],
  [/เสาร์/, "sat"],
];
const ZODIAC_KEYS: Array<[RegExp, string]> = [
  [/เมษ/, "aries"],
  [/พฤษภ/, "taurus"],
  [/เมถุน/, "gemini"],
  [/กรก[ฎฏ]/, "cancer"],
  [/สิงห์/, "leo"],
  [/กันย์/, "virgo"],
  [/ตุลย์/, "libra"],
  [/พิจิก/, "scorpio"],
  [/ธนู/, "sagittarius"],
  [/มังกร/, "capricorn"],
  [/กุมภ์/, "aquarius"],
  [/มีน/, "pisces"],
];
const DATED_QUESTION = /25[5-7]\d|20[12]\d|ครึ่งปี|หน้าฝน|หน้าร้อน|หน้าหนาว|สงกรานต์|ปีใหม่|วาเลนไทน์|เดือน(นี้|หน้า)|ปลายปี|ต้นปี|ลอยกระทง|ตรุษจีน|เข้าพรรษา/;
const PILE = /^(?:ไพ่)?(?:กอง|ใบ)(?:ที่)?\s*(\d+)/;

type WPPost = { id: number; date_gmt: string; link: string; title: { rendered: string }; content: { rendered: string } };

async function json<T>(url: string): Promise<{ data: T; pages: number }> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return { data: (await res.json()) as T, pages: Number(res.headers.get("x-wp-totalpages") ?? 1) };
    if (i >= 3) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
}

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** Keep simple text markup only; drop images, embeds, related-link lists, credits and outros. */
function clean(html: string): string {
  let h = html
    .replace(/<(script|style|iframe|figure)[\s\S]*?<\/\1>/gi, "")
    .replace(/<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>/gi, "<p><strong>$1</strong></p>") // sub-headings
    .replace(/<ul[^>]*>(?:(?!<\/ul>)[\s\S])*?has-vivid-green-cyan-color[\s\S]*?<\/ul>/gi, "") // "read also" lists
    .replace(/<(\/?)(p|ul|ol|li|strong|b|em|br)\b[^>]*>/gi, "<$1$2>")
    .replace(/<(?!\/?(p|ul|ol|li|strong|b|em|br)\b)[^>]+>/gi, "")
    .replace(/&nbsp;/g, " ");
  // Outro / credit paragraphs
  h = h.replace(/<p>(?:(?!<\/p>)[\s\S])*?(ที่มา|ขอบคุณ|ติดตามได้ที่|Brighttv|BRIGHT TV|โปรดใช้วิจารณญาณ)(?:(?!<\/p>)[\s\S])*?<\/p>/gi, "");
  h = h.replace(/<(p|li)>\s*<\/\1>/g, "").replace(/<ul>\s*<\/ul>/g, "").replace(/\s+/g, " ").trim();
  return h;
}

type Heading = { level: number; text: string; start: number; end: number };
function headings(html: string): Heading[] {
  return [...html.matchAll(/<h([2-5])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
    level: Number(m[1]),
    text: text(m[2]),
    start: m.index!,
    end: m.index! + m[0].length,
  }));
}

/**
 * Sections whose heading names one or more keys (day / zodiac / pile; e.g.
 * "ธาตุไฟ สิงห์ ธนู เมษ" → three), up to the next heading at the same or a
 * higher level.
 */
function sections(html: string, match: (heading: string) => string[]) {
  const hs = headings(html);
  const out: Array<{ key: string; heading: string; html: string; start: number }> = [];
  hs.forEach((h, i) => {
    if (h.text.length > 60) return;
    const keys = match(h.text);
    if (!keys.length) return;
    const next = hs.slice(i + 1).find((n) => n.level <= h.level || match(n.text).length);
    let body = clean(html.slice(h.end, next ? next.start : html.length));
    // Grouped heading: keep the group name ("ธาตุไฟ", "โทนสีน้ำเงิน") as the first line.
    if (keys.length > 1) body = `<p><strong>${h.text}</strong></p>${body}`;
    if (!text(body)) return;
    for (const key of keys) out.push({ key, heading: h.text, html: body, start: h.start });
  });
  return out;
}

/** Every key named in a heading ("พุธกลางคืน" only counts as wedn, not wed too). */
const keysOf = (table: Array<[RegExp, string]>) => (s: string) => {
  const keys = table.filter(([re]) => re.test(s)).map(([, k]) => k);
  return keys.includes("wedn") ? keys.filter((k) => k !== "wed") : keys;
};

/** Astrologer named in the lead quote ("<a>หมอชิน …</a> เผย …"). */
function authorOf(html: string): string | null {
  const lead = /<blockquote[\s\S]*?<\/blockquote>/i.exec(html)?.[0] ?? html.slice(0, 1500);
  const a = /<a[^>]*>([\s\S]*?)<\/a>/i.exec(lead);
  const name = a ? text(a[1]) : "";
  return name && name.length < 50 ? name : null;
}

const pathOf = (link: string) => new URL(link).pathname.replace(/\/$/, "");
const q = (v: string | number | null) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);

// ---------- profiles ----------
const profileRows: string[] = [];
{
  const ids = PROFILE_SOURCES.map((s) => s.id).join(",");
  const { data } = await json<WPPost[]>(`${WP}/posts?include=${ids}&per_page=100&_fields=id,date_gmt,link,title,content`);
  for (const src of PROFILE_SOURCES) {
    const p = data.find((d) => d.id === src.id);
    if (!p) {
      console.warn(`missing post ${src.id}`);
      continue;
    }
    const secs = sections(p.content.rendered, keysOf(src.kind === "day" ? DAY_KEYS : ZODIAC_KEYS));
    // Same key twice in one article (e.g. two lists) → one block.
    const byKey = new Map<string, string>();
    for (const s of secs) byKey.set(s.key, (byKey.get(s.key) ?? "") + s.html);
    console.log(`${src.kind} ${src.topic} (${p.id}): ${[...byKey.keys()].join(" ")}`);
    let sort = PROFILE_SOURCES.indexOf(src);
    for (const [key, html] of byKey) {
      profileRows.push(
        `(${q(src.kind)},${q(key)},${q(src.topic)},${p.id},${q(text(p.title.rendered))},${q(pathOf(p.link))},${q(authorOf(p.content.rendered))},${q(html)},${sort})`,
      );
    }
    sort++;
  }
}

// ---------- pick a card ----------
const cardRows: string[] = [];
{
  const seen = new Set<number>();
  for (const term of ["pick a card", "ดูดวงไพ่ทาโรต์"]) {
    for (let page = 1; ; page++) {
      const { data, pages } = await json<WPPost[]>(
        `${WP}/posts?search=${encodeURIComponent(term)}&per_page=100&page=${page}&_fields=id,date_gmt,link,title,content`,
      );
      for (const p of data) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const piles = sections(p.content.rendered, (h) => {
          const n = PILE.exec(h)?.[1];
          return n ? [n] : [];
        });
        if (piles.length < 2 || piles.length > 6) continue;
        const firstPile = piles[0].start;
        const imgs = [...p.content.rendered.slice(0, firstPile).matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]);
        const question = text(p.title.rendered)
          .replace(/^ดูดวง\s*/, "")
          .replace(/pick\s*a\s*card\s*/i, "")
          .replace(/\s*(?:–|-|โดย)\s*(DiSaur|ดิซอ|Minnita|แม่หมอ|หมอ|อาจารย์|อ\.)[\s\S]*$/i, "")
          .replace(/^[“"'\s]+|[“”"'\s]+$/g, "")
          .trim();
        // Questions tied to a date or season don't age well.
        if (DATED_QUESTION.test(question)) continue;
        cardRows.push(
          `(${p.id},${q(question)},${q(pathOf(p.link))},${q(p.date_gmt.slice(0, 10))},${q(authorOf(p.content.rendered))},${q(imgs.at(-1) ?? null)},${q(
            JSON.stringify(piles.map((s) => ({ label: `กอง ${s.key}`, html: s.html }))),
          )})`,
        );
      }
      if (page >= pages) break;
    }
  }
  console.log(`pick a card: ${cardRows.length} articles`);
}

const sql = `
DROP TABLE IF EXISTS horo_profile;
CREATE TABLE horo_profile (kind TEXT NOT NULL, key TEXT NOT NULL, topic TEXT NOT NULL, post_id INTEGER NOT NULL, title TEXT NOT NULL, path TEXT NOT NULL, author TEXT, html TEXT NOT NULL, sort INTEGER NOT NULL, PRIMARY KEY (kind, key, post_id));
DROP TABLE IF EXISTS horo_cards;
CREATE TABLE horo_cards (id INTEGER PRIMARY KEY, question TEXT NOT NULL, path TEXT NOT NULL, date TEXT NOT NULL, author TEXT, image TEXT, piles TEXT NOT NULL);
${profileRows.map((r) => `INSERT INTO horo_profile VALUES ${r};`).join("\n")}
${cardRows.map((r) => `INSERT INTO horo_cards VALUES ${r};`).join("\n")}
`;
writeFileSync(".horoscope.sql", sql);
console.log(`wrote .horoscope.sql (${(sql.length / 1024).toFixed(0)} KB)`);
if (!dry) {
  execFileSync("npx", ["wrangler", "d1", "execute", "brighttv-horoscope", local ? "--local" : "--remote", "--file", ".horoscope.sql", "-y"], {
    stdio: "inherit",
  });
}
