/**
 * One-off: every draw since 2010 from GLO → D1 (`brighttv-lotto`).
 *   node scripts/backfill.ts [--from=2010-01] [--local]
 * Draws are on the 1st and 16th, sometimes moved a day or two (holidays),
 * so each slot tries nearby days until one has results. Writes SQL to
 * .backfill.sql and runs it with wrangler (remote unless --local).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fetchByDate, type LottoDraw } from "../src/glo.ts";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}`))?.split("=")[1];
const [fromY, fromM] = (arg("from") ?? "2010-01").split("-").map(Number);
const local = process.argv.includes("--local");

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (y: number, m: number, d: number) => iso(new Date(Date.UTC(y, m - 1, d)));

// Day offsets to try around each slot, most likely first.
const NEAR = [0, 1, -1, 2, -2, 3];

async function findDraw(y: number, m: number, day: number, seen: Set<string>): Promise<LottoDraw | null> {
  for (const off of NEAR) {
    const date = shift(y, m, day + off);
    if (seen.has(date) || date > iso(new Date())) continue;
    const draw = await fetchByDate(date).catch(() => null);
    if (draw && draw.date === date) return draw;
  }
  return null;
}

const draws = new Map<string, LottoDraw>();
const missing: string[] = [];
const now = new Date();
for (let y = fromY, m = fromM; y * 12 + m <= now.getUTCFullYear() * 12 + now.getUTCMonth() + 1; m === 12 ? (y++, (m = 1)) : m++) {
  const seen = new Set(draws.keys());
  const results = await Promise.all([findDraw(y, m, 1, seen), findDraw(y, m, 16, seen)]);
  results.forEach((d, i) => {
    if (d) draws.set(d.date, d);
    else if (shift(y, m, i ? 16 : 1) <= iso(now)) missing.push(shift(y, m, i ? 16 : 1));
  });
  process.stdout.write(`\r${y}-${String(m).padStart(2, "0")}: ${draws.size} draws`);
}
console.log(`\nfound ${draws.size} draws; no draw near: ${missing.join(", ") || "-"}`);

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sql = [...draws.values()]
  .sort((a, b) => a.date.localeCompare(b.date))
  .map(
    (d) =>
      `INSERT INTO lotto_draws (date, data, updated_at) VALUES (${q(d.date)}, ${q(JSON.stringify(d))}, ${Date.now()}) ` +
      `ON CONFLICT (date) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at;`,
  )
  .join("\n");
writeFileSync(".backfill.sql", sql + "\n");
execFileSync("npx", ["wrangler", "d1", "execute", "brighttv-lotto", local ? "--local" : "--remote", "--file", ".backfill.sql", "-y"], {
  stdio: "inherit",
});
