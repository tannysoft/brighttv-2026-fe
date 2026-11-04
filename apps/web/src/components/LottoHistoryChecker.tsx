"use client";

import Link from "next/link";
import { useState } from "react";
import { drawSlug, thaiDate } from "@/lib/lotto-check";
import type { HistoryWin } from "@/lib/lotto";

/** One ticket against every stored draw (since 2010), via /api/lotto/check. */
export default function LottoHistoryChecker() {
  const [ticket, setTicket] = useState("");
  const [state, setState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "error" } | { status: "done"; ticket: string; wins: HistoryWin[] }
  >({ status: "idle" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(ticket)) return;
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/lotto/check?n=${ticket}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { wins: HistoryWin[] };
      setState({ status: "done", ticket, wins: data.wins });
    } catch {
      setState({ status: "error" });
    }
  };

  return (
    <section className="rounded-2xl bg-white border border-[var(--bt-line)] shadow-sm overflow-hidden">
      <div className="bg-gradient-to-br from-[var(--bt-navy)] to-[#0a4570] px-5 py-4">
        <h2 className="text-lg font-extrabold !text-white">ตรวจย้อนหลังทุกงวด</h2>
        <p className="mt-1 text-[11px] !text-white/85">เลขเดียว ตรวจกับทุกงวดตั้งแต่ปี 2553</p>
      </div>
      <form onSubmit={submit} className="p-5 flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={ticket}
          onChange={(e) => setTicket(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="ใส่เลข 6 หลัก"
          aria-label="เลขสลาก 6 หลัก"
          className="min-w-0 flex-1 h-11 px-3 rounded-lg border border-[var(--bt-line)] bg-[var(--bt-bg)] focus:bg-white focus:border-[var(--bt-navy)] text-lg font-extrabold tabular-nums text-center tracking-widest text-[var(--bt-text)] outline-none"
        />
        <button
          type="submit"
          disabled={ticket.length !== 6 || state.status === "loading"}
          className="h-11 px-5 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] disabled:opacity-50 !text-white text-sm font-bold"
        >
          {state.status === "loading" ? "กำลังตรวจ…" : "ตรวจ"}
        </button>
      </form>

      <div className="px-5 pb-5" aria-live="polite">
        {state.status === "error" && <p className="text-sm text-[var(--bt-red)]">ตรวจไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
        {state.status === "done" &&
          (state.wins.length === 0 ? (
            <p className="text-sm text-[var(--bt-muted)] text-center">
              เลข <b className="tabular-nums text-[var(--bt-text)]">{state.ticket}</b> ไม่เคยถูกรางวัลตั้งแต่ปี 2553
            </p>
          ) : (
            <>
              <p className="text-sm text-[var(--bt-text)] mb-3">
                เลข <b className="tabular-nums">{state.ticket}</b> เคยถูกรางวัล {state.wins.length} งวด
              </p>
              <ul className="space-y-2 max-h-80 overflow-y-auto">
                {state.wins.map((w) => (
                  <li key={w.date} className="rounded-lg border border-green-200 bg-green-50 p-3 text-[12px]">
                    <Link href={`/lotto/${drawSlug(w.date)}`} className="font-bold text-[var(--bt-navy)] hover:underline">
                      งวด {thaiDate(w.date)}
                    </Link>
                    {w.wins.map((p, i) => (
                      <div key={i} className="flex justify-between mt-1">
                        <span>{p.name}</span>
                        <span className="font-extrabold text-green-700 tabular-nums">{p.reward.toLocaleString("th-TH")} ฿</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </>
          ))}
      </div>
    </section>
  );
}
