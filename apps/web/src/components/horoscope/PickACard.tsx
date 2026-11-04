"use client";

import Link from "next/link";
import { useState } from "react";
import type { PickCard } from "@/lib/horoscope";

/**
 * "Pick a card" from the archive of tarot-reader articles: the question and
 * its spread image, face-down piles; picking one reveals that pile's reading.
 */
export default function PickACard({ initial }: { initial: PickCard }) {
  const [card, setCard] = useState(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const another = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/horoscope/card?not=${card.id}`);
      if (res.ok) {
        setCard(((await res.json()) as { card: PickCard }).card);
        setPicked(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const pile = picked !== null ? card.piles[picked] : null;

  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#2b1b4d] to-[#120b24] p-5 sm:p-6 !text-white" aria-labelledby="pick-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#f2c14e]">Pick a card</p>
          <h2 id="pick-title" className="mt-1 text-lg sm:text-2xl font-extrabold !text-white">
            {card.question}
          </h2>
          <p className="mt-1 text-xs !text-white/70">ตั้งจิต นึกถึงคำถาม แล้วเลือก 1 กองที่ดึงดูดคุณที่สุด</p>
        </div>
        <button
          type="button"
          onClick={another}
          disabled={loading}
          className="shrink-0 rounded-full border border-white/25 px-3 py-1.5 text-xs font-bold !text-white hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? "กำลังสุ่ม…" : "คำถามอื่น ↻"}
        </button>
      </div>

      {card.image && (
        // The reader's photo of the spread (piles left to right).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image} alt={`ไพ่ ${card.piles.length} กอง`} className="mt-4 w-full rounded-xl object-cover max-h-[320px]" loading="lazy" />
      )}

      <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${card.piles.length}, minmax(0, 1fr))` }}>
        {card.piles.map((p, i) => (
          <button
            key={`${card.id}-${i}`}
            type="button"
            onClick={() => setPicked(i)}
            aria-pressed={picked === i}
            className={`h-12 rounded-xl border text-sm font-extrabold transition-colors ${
              picked === i
                ? "bg-[#f2c14e] border-[#f2c14e] text-[#2b1b4d]"
                : "border-[#f2c14e]/50 !text-white hover:border-[#f2c14e] hover:bg-white/5"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4" aria-live="polite">
        {pile ? (
          <div className="rounded-xl bg-white/[0.06] p-4">
            <p className="text-sm font-extrabold text-[#f2c14e]">{pile.label}</p>
            <div className="horo-text mt-2 text-sm leading-relaxed !text-white/90" dangerouslySetInnerHTML={{ __html: pile.html }} />
            <Link href={card.path} className="mt-3 inline-block text-xs font-bold !text-[#f2c14e] hover:underline">
              อ่านบทความเต็ม{card.author ? ` โดย ${card.author}` : ""} ›
            </Link>
          </div>
        ) : (
          <p className="text-xs !text-white/60">คำทำนายของกองที่เลือกจะแสดงที่นี่</p>
        )}
      </div>
    </section>
  );
}
