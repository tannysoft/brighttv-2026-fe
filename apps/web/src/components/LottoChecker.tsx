"use client";

import { useState } from "react";
import { checkTicket, thaiDate, type LottoDraw, type TicketWin } from "@/lib/lotto-check";

type CheckResult = {
  ticket: string;
  status: "win" | "lose" | "invalid";
  prizes: TicketWin[];
  total: number;
};

/** Checks up to 5 tickets against one draw (rewards come from that draw). */
export default function LottoChecker({ draw }: { draw: LottoDraw | null }) {
  const [tickets, setTickets] = useState<string[]>(["", "", "", "", ""]);
  const [checked, setChecked] = useState<CheckResult[] | null>(null);

  const check = (raw: string): CheckResult => {
    const ticket = raw.replace(/\D/g, "").slice(0, 6);
    if (ticket.length !== 6) return { ticket, status: "invalid", prizes: [], total: 0 };
    const prizes = draw ? checkTicket(draw, ticket) : [];
    const total = prizes.reduce((s, p) => s + p.reward, 0);
    return { ticket, status: prizes.length ? "win" : "lose", prizes, total };
  };

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const nonEmpty = tickets.filter((t) => t.trim() !== "");
    setChecked(nonEmpty.length ? nonEmpty.map(check) : null);
  };

  const handleClear = () => {
    setTickets(["", "", "", "", ""]);
    setChecked(null);
  };

  const setTicket = (i: number, v: string) => {
    const next = [...tickets];
    next[i] = v.replace(/\D/g, "").slice(0, 6);
    setTickets(next);
  };

  const totalWin = checked?.reduce((s, c) => s + c.total, 0) || 0;
  const winCount = checked?.filter((c) => c.status === "win").length || 0;
  const drawLabel = draw ? thaiDate(draw.date) : "";

  return (
    <aside className="rounded-2xl bg-white border border-[var(--bt-line)] shadow-sm overflow-hidden">
      <div className="bg-gradient-to-br from-[var(--bt-red)] to-[#a91a1f] px-5 py-4 !text-white">
        <h2 className="text-lg sm:text-xl font-extrabold !text-white flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          ตรวจเลขที่ซื้อ
        </h2>
        <p className="mt-1 text-[11px] !text-white/85">
          ใส่เลขสลาก 6 หลัก ได้สูงสุด 5 ใบ{drawLabel && <> · งวด {drawLabel}</>}
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
