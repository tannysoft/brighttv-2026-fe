"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PickCard } from "@/lib/horoscope";

// Sparkles that burst from the chosen card: [x, y] offsets in px.
const SPARKS: Array<[number, number]> = [
  [-70, -60], [70, -70], [-90, 10], [95, 0], [-55, 75], [60, 80], [0, -95], [10, 95],
];

/**
 * "Pick a card" from the archive of tarot-reader articles. Cards are dealt
 * face-down and float while you choose; the chosen one flips over with a
 * burst of sparkles and its reading fades in. ("คำถามอื่น" deals again.)
 */
export default function PickACard({ initial }: { initial: PickCard | null }) {
  const [card, setCard] = useState(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [round, setRound] = useState(0); // re-deals the cards

  // The page may have been rendered without data (e.g. prerendered at build):
  // load today's question in the browser.
  useEffect(() => {
    if (card) return;
    fetch("/api/horoscope/card?today=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { card?: PickCard } | null) => d?.card && setCard(d.card))
      .catch(() => {});
  }, [card]);

  const another = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/horoscope/card?not=${card?.id ?? ""}`);
      if (res.ok) {
        setCard(((await res.json()) as { card: PickCard }).card);
        setPicked(null);
        setRound((r) => r + 1);
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPicked(null);
    setRound((r) => r + 1);
  };

  if (!card) {
    return <section className="min-h-[420px] animate-pulse rounded-2xl bg-gradient-to-br from-[#2b1b4d] via-[#1d1238] to-[#0d0820]" aria-busy />;
  }
  const n = card.piles.length;
  const pile = picked !== null ? card.piles[picked] : null;

  return (
    <section
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2b1b4d] via-[#1d1238] to-[#0d0820] p-5 sm:p-6 !text-white"
      aria-labelledby="pick-title"
    >
      {/* Starry backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 20% 30%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 70% 20%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 40% 80%, #f2c14e 50%, transparent 51%), radial-gradient(1px 1px at 85% 65%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 10% 85%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 60% 50%, #fff 50%, transparent 51%)",
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#f2c14e]">Pick a card</p>
          <h2 id="pick-title" key={card.id} className="pc-reveal mt-1 text-lg sm:text-2xl font-extrabold !text-white" style={{ animationDelay: "0s" }}>
            {card.question}
          </h2>
          <p className="mt-1 text-sm !text-white/70">ตั้งจิต นึกถึงคำถาม แล้วเลือก 1 กองที่ดึงดูดคุณที่สุด</p>
        </div>
        <button
          type="button"
          onClick={another}
          disabled={loading}
          className="shrink-0 rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold !text-white hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? "กำลังสับไพ่…" : "คำถามอื่น ↻"}
        </button>
      </div>

      {/* Face-down cards */}
      <div className="relative mt-5 grid gap-3 sm:gap-4" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {card.piles.map((p, i) => {
          const chosen = picked === i;
          const other = picked !== null && !chosen;
          return (
            <div
              key={`${card.id}-${round}-${i}`}
              className="pc-deal"
              style={{ ["--d" as string]: `${i * 0.12}s`, ["--r" as string]: `${(i - (n - 1) / 2) * 8}deg` }}
            >
              <div
                className={`transition-all duration-500 ${picked === null ? "pc-float" : ""} ${other ? "opacity-35 scale-90 blur-[1px]" : ""}`}
                style={{ ["--f" as string]: `${i * 0.4}s` }}
              >
                <button
                  type="button"
                  onClick={() => picked === null && setPicked(i)}
                  disabled={picked !== null}
                  aria-pressed={chosen}
                  aria-label={`เลือก${p.label}`}
                  className={`pc-card relative mx-auto block aspect-[2/3] w-full max-w-[150px] ${chosen ? "pc-flipped" : ""} ${
                    picked === null ? "cursor-pointer hover:-translate-y-2 transition-transform" : "cursor-default"
                  }`}
                >
                  <span className="pc-inner block">
                    {/* Back */}
                    <span className="pc-face grid place-items-center border-2 border-[#f2c14e]/70 bg-[repeating-linear-gradient(45deg,#3b2a66,#3b2a66_7px,#2b1b4d_7px,#2b1b4d_14px)] shadow-lg">
                      <span className="grid h-12 w-12 place-items-center rounded-full border border-[#f2c14e]/60 text-2xl text-[#f2c14e]">✦</span>
                    </span>
                    {/* Front */}
                    <span
                      className={`pc-face pc-front pc-shimmer flex flex-col items-center justify-center border-2 border-[#f2c14e] bg-[linear-gradient(110deg,#f7e7b4_35%,#fff6d6_50%,#f7e7b4_65%)] text-[#2b1b4d] ${chosen ? "pc-glow" : ""}`}
                    >
                      <span className="text-3xl">☾</span>
                      <span className="mt-1 text-sm font-extrabold">{p.label}</span>
                    </span>
                  </span>
                  {/* Sparkle burst */}
                  {chosen &&
                    SPARKS.map(([x, y], k) => (
                      <span
                        key={k}
                        aria-hidden
                        className="pc-spark left-1/2 top-1/2 text-lg"
                        style={{ ["--x" as string]: `${x}px`, ["--y" as string]: `${y}px`, ["--d" as string]: `${0.35 + k * 0.04}s` }}
                      >
                        ✦
                      </span>
                    ))}
                </button>
                <p className={`mt-2 text-center text-sm font-bold ${chosen ? "text-[#f2c14e]" : "!text-white/80"}`}>{p.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-5" aria-live="polite">
        {pile ? (
          <div key={`${card.id}-${picked}`} className="pc-reveal rounded-xl border border-[#f2c14e]/25 bg-white/[0.06] p-5">
            <p className="text-base font-extrabold text-[#f2c14e]">คำทำนาย{pile.label}</p>
            <div className="horo-text mt-2 text-[16px] leading-[1.75] !text-white/90" dangerouslySetInnerHTML={{ __html: pile.html }} />
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button type="button" onClick={reset} className="rounded-full bg-[#f2c14e] px-4 py-2 text-sm font-extrabold text-[#2b1b4d] hover:brightness-110">
                เลือกใหม่
              </button>
              <Link href={card.path} className="text-sm font-bold !text-[#f2c14e] hover:underline">
                อ่านบทความเต็ม{card.author ? ` โดย ${card.author}` : ""} ›
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm !text-white/60">แตะไพ่ที่ดึงดูดคุณ เพื่อเปิดคำทำนาย</p>
        )}
      </div>
    </section>
  );
}
