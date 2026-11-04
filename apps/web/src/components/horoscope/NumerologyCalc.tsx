"use client";

import { useState } from "react";
import { NUMEROLOGY, lifePath } from "@/lib/horoscope-data";

/** Life-path number from a birth date (Gregorian or Buddhist year). */
export default function NumerologyCalc() {
  const [d, setD] = useState("");
  const [m, setM] = useState("");
  const [y, setY] = useState("");
  const [n, setN] = useState<number | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const day = Number(d), month = Number(m);
    let year = Number(y);
    if (year > 2400) year -= 543; // พ.ศ. → ค.ศ.
    if (!day || day > 31 || !month || month > 12 || year < 1900 || year > 2100) return setN(null);
    setN(lifePath(day, month, year));
  };

  const field =
    "h-11 w-full rounded-lg border border-[var(--bt-line)] bg-[var(--bt-bg)] px-2 text-center text-base font-bold text-[var(--bt-text)] focus:bg-white focus:border-[var(--bt-navy)] outline-none";

  return (
    <section className="rounded-2xl border border-[var(--bt-line)] bg-white p-5 sm:p-6 flex flex-col">
      <h2 className="text-lg sm:text-xl font-extrabold text-[var(--bt-navy)]">เลขศาสตร์วันเกิด</h2>
      <p className="mt-1 text-xs text-[var(--bt-muted)]">ใส่วันเดือนปีเกิด (ปี พ.ศ. หรือ ค.ศ. ก็ได้)</p>
      <form onSubmit={submit} className="mt-4 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
        <input aria-label="วัน" inputMode="numeric" maxLength={2} placeholder="วัน" value={d} onChange={(e) => setD(e.target.value.replace(/\D/g, ""))} className={field} />
        <input aria-label="เดือน" inputMode="numeric" maxLength={2} placeholder="เดือน" value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, ""))} className={field} />
        <input aria-label="ปี" inputMode="numeric" maxLength={4} placeholder="ปี" value={y} onChange={(e) => setY(e.target.value.replace(/\D/g, ""))} className={field} />
        <button type="submit" className="col-span-3 h-11 rounded-full bg-[var(--bt-navy)] hover:bg-[var(--bt-navy-700)] !text-white text-sm font-bold">
          คำนวณ
        </button>
      </form>
      <div className="mt-4 min-h-[64px]" aria-live="polite">
        {n ? (
          <div className="flex gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--bt-red)] text-2xl font-extrabold !text-white">{n}</span>
            <div>
              <p className="font-extrabold text-[var(--bt-navy)]">เลข {n} · {NUMEROLOGY[n].title}</p>
              <p className="mt-0.5 text-sm text-[var(--bt-text)]">{NUMEROLOGY[n].text}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--bt-muted)]">ผลรวมตัวเลขวันเกิดจะบอกบุคลิกพื้นฐานของคุณ</p>
        )}
      </div>
    </section>
  );
}
