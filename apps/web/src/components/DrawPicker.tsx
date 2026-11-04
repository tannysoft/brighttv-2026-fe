"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { drawSlug, thaiDate } from "@/lib/lotto-check";

const dayMonth = (iso: string) =>
  new Date(`${iso}T00:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });

/**
 * Draw selector: one button showing the current draw; opens a panel (upward,
 * since it sits at the bottom of the sticky sidebar) with
 * year arrows and that year's draws as a grid.
 */
export default function DrawPicker({ dates, current }: { dates: string[]; current: string | null }) {
  const years = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of dates) m.set(d.slice(0, 4), [...(m.get(d.slice(0, 4)) ?? []), d]);
    return m;
  }, [dates]);
  const yearList = [...years.keys()]; // newest first
  const shown = current ?? dates[0] ?? "";
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(shown.slice(0, 4));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const i = yearList.indexOf(year);
  const arrow =
    "grid h-8 w-8 place-items-center rounded-full text-[var(--bt-navy)] hover:bg-[var(--bt-bg)] disabled:opacity-25 disabled:hover:bg-transparent";

  return (
    <div ref={box} className="relative mt-3">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setYear(shown.slice(0, 4));
          setOpen((o) => !o);
        }}
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-[var(--bt-line)] bg-[var(--bt-bg)] px-3.5 text-left hover:border-[var(--bt-navy)] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--bt-red)]" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className="flex-1 truncate text-sm font-bold text-[var(--bt-navy)]">
          {shown ? `งวด ${thaiDate(shown)}` : "เลือกงวด"}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-[var(--bt-muted)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div role="dialog" aria-label="เลือกงวด" className="absolute left-0 right-0 bottom-full z-30 mb-2 max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--bt-line)] bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="ปีก่อนหน้า" disabled={i >= yearList.length - 1} onClick={() => setYear(yearList[i + 1])} className={arrow}>
              ‹
            </button>
            <span className="text-sm font-extrabold text-[var(--bt-navy)]">ปี {Number(year) + 543}</span>
            <button type="button" aria-label="ปีถัดไป" disabled={i <= 0} onClick={() => setYear(yearList[i - 1])} className={arrow}>
              ›
            </button>
          </div>
          <ul className="grid grid-cols-3 gap-1.5">
            {(years.get(year) ?? []).map((d) => (
              <li key={d}>
                <Link
                  href={`/lotto/${drawSlug(d)}`}
                  onClick={() => setOpen(false)}
                  aria-current={d === current ? "page" : undefined}
                  className={`block rounded-lg py-2 text-center text-[13px] font-semibold transition-colors ${
                    d === current
                      ? "bg-[var(--bt-navy)] !text-white"
                      : "bg-[var(--bt-bg)] text-[var(--bt-text)] hover:bg-[var(--bt-red)] hover:!text-white"
                  }`}
                >
                  {dayMonth(d)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
