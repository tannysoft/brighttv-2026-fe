"use client";

import { useMemo, useState } from "react";
import type { LottoResult } from "@/lib/wp";

type CheckResult = {
  ticket: string;
  status: "win" | "lose" | "invalid";
  prizes: Array<{ name: string; reward: number }>;
  total: number;
};

const REWARD: Record<string, number> = {
  prizeFirst: 6_000_000,
  prizeFirstNear: 100_000,
  prizeSecond: 200_000,
  prizeThird: 80_000,
  prizeForth: 40_000,
  prizeFifth: 20_000,
  runningNumberFrontThree: 4_000,
  runningNumberBackThree: 4_000,
  runningNumberBackTwo: 2_000,
};

const PRIZE_NAME: Record<string, string> = {
  prizeFirst: "รางวัลที่ 1",
  prizeFirstNear: "รางวัลข้างเคียงรางวัลที่ 1",
  prizeSecond: "รางวัลที่ 2",
  prizeThird: "รางวัลที่ 3",
  prizeForth: "รางวัลที่ 4",
  prizeFifth: "รางวัลที่ 5",
  runningNumberFrontThree: "เลขหน้า 3 ตัว",
  runningNumberBackThree: "เลขท้าย 3 ตัว",
  runningNumberBackTwo: "เลขท้าย 2 ตัว",
};

export default function LottoChecker({ result }: { result: LottoResult | null }) {
  const [tickets, setTickets] = useState<string[]>(["", "", "", "", ""]);
  const [checked, setChecked] = useState<CheckResult[] | null>(null);

  const lookup = useMemo(() => {
    if (!result) return null;
    const map = new Map<string, Set<string>>();
    for (const p of result.prizes) {
      map.set(p.id, new Set(p.number));
    }
    for (const p of result.runningNumbers) {
      map.set(p.id, new Set(p.number));
    }
    return map;
  }, [result]);

  const checkTicket = (raw: string): CheckResult => {
    const ticket = raw.replace(/\D/g, "").slice(0, 6);
    if (ticket.length !== 6) {
      return { ticket, status: "invalid", prizes: [], total: 0 };
    }
    if (!lookup) {
      return { ticket, status: "lose", prizes: [], total: 0 };
    }

    const prizes: CheckResult["prizes"] = [];

    // Check main prize matches
    for (const key of [
      "prizeFirst",
      "prizeFirstNear",
      "prizeSecond",
      "prizeThird",
      "prizeForth",
      "prizeFifth",
    ]) {
      if (lookup.get(key)?.has(ticket)) {
        prizes.push({ name: PRIZE_NAME[key], reward: REWARD[key] });
      }
    }

    // Front 3 — first 3 digits
    const front = ticket.slice(0, 3);
    if (lookup.get("runningNumberFrontThree")?.has(front)) {
      prizes.push({
        name: PRIZE_NAME.runningNumberFrontThree,
        reward: REWARD.runningNumberFrontThree,
      });
    }

    // Back 3 — last 3 digits
    const back3 = ticket.slice(-3);
    if (lookup.get("runningNumberBackThree")?.has(back3)) {
      prizes.push({
        name: PRIZE_NAME.runningNumberBackThree,
        reward: REWARD.runningNumberBackThree,
      });
    }

    // Back 2 — last 2 digits
    const back2 = ticket.slice(-2);
    if (lookup.get("runningNumberBackTwo")?.has(back2)) {
      prizes.push({
        name: PRIZE_NAME.runningNumberBackTwo,
        reward: REWARD.runningNumberBackTwo,
      });
    }

    const total = prizes.reduce((s, p) => s + p.reward, 0);
    return {
      ticket,
      status: prizes.length ? "win" : "lose",
      prizes,
      total,
    };
  };

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const nonEmpty = tickets.filter((t) => t.trim() !== "");
    if (nonEmpty.length === 0) {
      setChecked(null);
      return;
    }
    setChecked(nonEmpty.map((t) => checkTicket(t)));
  };

  const handleClear = () => {
    setTickets(["", "", "", "", ""]);
    setChecked(null);
  };

  const setTicket = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 6);
    const next = [...tickets];
    next[i] = clean;
    setTickets(next);
  };

  const totalWin = checked?.reduce((s, c) => s + c.total, 0) || 0;
  const winCount = checked?.filter((c) => c.status === "win").length || 0;

  return (
    <aside className="rounded-2xl bg-white border border-[var(--bt-line)] shadow-sm overflow-hidden sticky top-[160px]">
      <div className="bg-gradient-to-br from-[var(--bt-red)] to-[#a91a1f] px-5 py-4 !text-white">
        <h2 className="text-lg sm:text-xl font-extrabold !text-white flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          ตรวจเลขที่ซื้อ
        </h2>
        <p className="mt-1 text-[11px] !text-white/85">
          ใส่เลขสลาก 6 หลัก ได้สูงสุด 5 ใบ
        </p>
      </div>

      <form onSubmit={handleCheck} className="p-5 space-y-3">
        {tickets.map((t, i) => (
          <div key={i} className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--bt-muted)] pointer-events-none">
              {i + 1}.
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={t}
              onChange={(e) => setTicket(i, e.target.value)}
              placeholder="ใส่เลข 6 หลัก"
              className="w-full h-11 pl-8 pr-3 rounded-lg border border-[var(--bt-line)] bg-[var(--bt-bg)] focus:bg-white focus:border-[var(--bt-navy)] text-lg font-extrabold tabular-nums text-center tracking-widest text-[var(--bt-text)] outline-none transition-colors"
            />
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            className="flex-1 h-11 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white text-sm font-bold transition-colors"
          >
            ตรวจหวย
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="h-11 px-4 rounded-full bg-white hover:bg-[var(--bt-bg)] text-[var(--bt-navy)] text-sm font-bold border border-[var(--bt-line)] transition-colors"
          >
            ล้าง
          </button>
        </div>
      </form>

      {/* Results */}
      {checked && checked.length > 0 && (
        <div className="px-5 pb-5">
          <div className="border-t border-[var(--bt-line)] pt-4">
            {/* Summary */}
            <div
              className={`rounded-xl p-4 text-center ${
                winCount > 0
                  ? "bg-gradient-to-br from-[#e6fff0] to-[#c4f5d4] border border-green-200"
                  : "bg-[var(--bt-bg)] border border-[var(--bt-line)]"
              }`}
            >
              {winCount > 0 ? (
                <>
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wider">
                    🎉 ยินดีด้วย!
                  </p>
                  <p className="mt-1 text-sm text-[var(--bt-muted)]">
                    ถูกรางวัล {winCount} ใบ รวม
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-green-700">
                    {totalWin.toLocaleString("th-TH")} บาท
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-[var(--bt-text)]">เสียใจด้วย</p>
                  <p className="mt-1 text-xs text-[var(--bt-muted)]">
                    ไม่ถูกรางวัลงวดนี้ ลองงวดหน้านะ
                  </p>
                </>
              )}
            </div>

            {/* Per-ticket details */}
            <ul className="mt-4 space-y-2">
              {checked.map((c, i) => (
                <li
                  key={i}
                  className={`rounded-lg border p-3 ${
                    c.status === "win"
                      ? "bg-green-50 border-green-200"
                      : c.status === "invalid"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-[var(--bt-bg)] border-[var(--bt-line)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold tabular-nums text-[var(--bt-text)] text-lg tracking-wider">
                      {c.ticket || "—"}
                    </span>
                    {c.status === "win" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-600 !text-white text-[10px] font-bold">
                        ✓ ถูก
                      </span>
                    ) : c.status === "invalid" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500 !text-white text-[10px] font-bold">
                        ต้องครบ 6 หลัก
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bt-muted)] !text-white text-[10px] font-bold">
                        ไม่ถูก
                      </span>
                    )}
                  </div>
                  {c.prizes.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {c.prizes.map((p, j) => (
                        <li
                          key={j}
                          className="flex items-center justify-between text-[12px] text-[var(--bt-text)]"
                        >
                          <span className="font-semibold">{p.name}</span>
                          <span className="font-extrabold text-green-700 tabular-nums">
                            {p.reward.toLocaleString("th-TH")} ฿
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="px-5 pb-5">
        <p className="text-[10px] text-[var(--bt-muted)] text-center">
          * ผลการตรวจเป็นเพียงข้อมูลเบื้องต้น กรุณาตรวจสอบกับสลากต้นฉบับ
        </p>
      </div>
    </aside>
  );
}
