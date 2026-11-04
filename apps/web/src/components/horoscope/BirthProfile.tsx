"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DAY_COLORS, ZODIACS } from "@/lib/horoscope-data";
import type { ProfileKind, ProfileSection } from "@/lib/horoscope";

const ZODIAC_KEYS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
const STORE = "bt-horo-profile";

/**
 * "ดวงประจำตัวคุณ": pick a day of birth or a zodiac sign → personality,
 * lucky numbers/colours, soulmate… from the astrologers' articles. The
 * choice is remembered on this device.
 */
export default function BirthProfile({ defaultDay }: { defaultDay: string }) {
  const [kind, setKind] = useState<ProfileKind>("day");
  const [key, setKey] = useState(defaultDay);
  const [sections, setSections] = useState<ProfileSection[] | null>(null);
  const [error, setError] = useState(false);

  // Restore the last choice.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as { kind: ProfileKind; key: string } | null;
      if (saved?.kind && saved.key) {
        setKind(saved.kind);
        setKey(saved.key);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let live = true;
    setSections(null);
    setError(false);
    fetch(`/api/horoscope/profile?kind=${kind}&key=${key}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { sections: ProfileSection[] }) => live && setSections(d.sections))
      .catch(() => live && setError(true));
    try {
      localStorage.setItem(STORE, JSON.stringify({ kind, key }));
    } catch {}
    return () => {
      live = false;
    };
  }, [kind, key]);

  const switchKind = (k: ProfileKind) => {
    setKind(k);
    setKey(k === "day" ? defaultDay : "aries");
  };

  const day = DAY_COLORS.find((d) => d.key === key);
  const zodiac = ZODIACS[ZODIAC_KEYS.indexOf(key)];
  const who = kind === "day" ? `คนเกิด${day?.day ?? ""}` : `ชาว${zodiac?.name ?? ""}`;
  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
      active ? "bg-[var(--bt-navy)] !text-white" : "bg-[var(--bt-bg)] text-[var(--bt-text)] hover:bg-[var(--bt-line)]"
    }`;

  return (
    <section className="rounded-2xl border border-[var(--bt-line)] bg-white p-5 sm:p-7" aria-labelledby="profile-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="profile-title" className="text-xl sm:text-2xl font-extrabold text-[var(--bt-navy)]">ดวงประจำตัวคุณ</h2>
          <p className="mt-1 text-xs text-[var(--bt-muted)]">นิสัย เลขมงคล สีเสริมดวง คู่แท้ และอีกมาก จากหมอดูของ BRIGHT TV</p>
        </div>
        <div className="inline-flex rounded-full bg-[var(--bt-bg)] p-1" role="tablist">
          {(["day", "zodiac"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => switchKind(k)} className={chip(kind === k)}>
              {k === "day" ? "ตามวันเกิด" : "ตามราศี"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {kind === "day"
          ? DAY_COLORS.map((d) => (
              <button key={d.key} type="button" onClick={() => setKey(d.key)} aria-pressed={key === d.key} className={chip(key === d.key)}>
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: d.hex }} />
                {d.day.replace("วัน", "")}
              </button>
            ))
          : ZODIACS.map((z, i) => (
              <button key={z.tag} type="button" onClick={() => setKey(ZODIAC_KEYS[i])} aria-pressed={key === ZODIAC_KEYS[i]} className={chip(key === ZODIAC_KEYS[i])}>
                <span className="mr-1">{z.symbol}</span>
                {z.name.replace("ราศี", "")}
              </button>
            ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        {kind === "day" && day && <span className="h-10 w-10 rounded-full border-2 border-white shadow" style={{ background: day.hex }} />}
        {kind === "zodiac" && zodiac && (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--bt-navy)] text-lg !text-white">{zodiac.symbol}</span>
        )}
        <p className="text-lg font-extrabold text-[var(--bt-navy)]">
          {who}
          {kind === "day" && day && <span className="ml-2 text-sm font-semibold text-[var(--bt-muted)]">สีประจำวันเกิด: {day.color}</span>}
        </p>
      </div>

      <div className="mt-4" aria-live="polite">
        {error ? (
          <p className="text-sm text-[var(--bt-red)]">โหลดไม่สำเร็จ ลองใหม่อีกครั้ง</p>
        ) : !sections ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-[var(--bt-bg)]" />
            ))}
          </div>
        ) : sections.length === 0 ? (
          <p className="text-sm text-[var(--bt-muted)]">ยังไม่มีคำทำนายสำหรับ{who}</p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
            {sections.map((s, i) => (
              <article key={i} className="mb-3 break-inside-avoid rounded-xl bg-[var(--bt-bg)] p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--bt-red)]">{s.topic}</p>
                <div className="horo-text mt-1.5 text-sm leading-relaxed text-[var(--bt-text)]" dangerouslySetInnerHTML={{ __html: s.html }} />
                <Link href={s.path} className="mt-2 block text-[11px] font-semibold text-[var(--bt-muted)] hover:text-[var(--bt-red)]">
                  {s.author ? `${s.author} · ` : ""}อ่านบทความเต็ม ›
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
