"use client";

import Link from "next/link";
import { useState } from "react";
import { DAY_COLORS } from "@/lib/horoscope-data";

/** Pick a day of birth → its traditional colour. */
export default function BirthdayColor({ todayKey, moreHref }: { todayKey: string; moreHref: string }) {
  const [key, setKey] = useState(todayKey);
  const c = DAY_COLORS.find((d) => d.key === key) ?? DAY_COLORS[0];
  return (
    <section className="rounded-2xl border border-[var(--bt-line)] bg-white p-5 sm:p-6 flex flex-col">
      <h2 className="text-lg sm:text-xl font-extrabold text-[var(--bt-navy)]">สีประจำวันเกิด</h2>
      <p className="mt-1 text-xs text-[var(--bt-muted)]">คุณเกิดวันอะไร</p>
      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {DAY_COLORS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setKey(d.key)}
            aria-pressed={d.key === key}
            className={`rounded-lg py-2 text-[12px] font-semibold leading-tight transition-colors ${
              d.key === key ? "bg-[var(--bt-navy)] !text-white" : "bg-[var(--bt-bg)] text-[var(--bt-text)] hover:bg-[var(--bt-line)]"
            }`}
          >
            {d.day.replace("วัน", "")}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3" aria-live="polite">
        <span className="h-14 w-14 shrink-0 rounded-full border-4 border-white shadow-md" style={{ background: c.hex }} />
        <div>
          <p className="text-sm text-[var(--bt-muted)]">คนเกิด{c.day}</p>
          <p className="text-lg font-extrabold text-[var(--bt-navy)]">{c.color}</p>
        </div>
      </div>
      <Link href={moreHref} className="mt-auto pt-4 text-xs font-bold text-[var(--bt-red)] hover:underline">
        อ่านสีมงคลเสริมดวงล่าสุด ›
      </Link>
    </section>
  );
}
