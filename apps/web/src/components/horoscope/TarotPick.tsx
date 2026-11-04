"use client";

import Link from "next/link";
import { useState } from "react";
import { TAROT, type TarotCard } from "@/lib/horoscope-data";

/** Pick one of three face-down cards; reveals a random major arcana card. */
export default function TarotPick({ moreHref }: { moreHref: string }) {
  const [card, setCard] = useState<TarotCard | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  const pick = (i: number) => {
    if (card) return;
    setPicked(i);
    setCard(TAROT[Math.floor(Math.random() * TAROT.length)]);
  };

  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#2b1b4d] to-[#120b24] p-5 sm:p-6 !text-white flex flex-col">
      <h2 className="text-lg sm:text-xl font-extrabold !text-white">ไพ่ทาโรต์ประจำวัน</h2>
      <p className="mt-1 text-xs !text-white/70">ตั้งจิตอธิษฐาน แล้วเลือกไพ่ 1 ใบ</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => {
          const open = card && picked === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={Boolean(card)}
              aria-label={open ? card!.en : `เลือกไพ่ใบที่ ${i + 1}`}
              className={`aspect-[2/3] rounded-xl border transition-all ${
                open
                  ? "bg-[#f7e7b4] border-[#f2c14e] text-[#2b1b4d] scale-105 shadow-lg"
                  : card
                    ? "bg-white/5 border-white/10 opacity-40"
                    : "bg-[repeating-linear-gradient(45deg,#3b2a66,#3b2a66_6px,#2b1b4d_6px,#2b1b4d_12px)] border-[#f2c14e]/60 hover:-translate-y-1 hover:border-[#f2c14e]"
              }`}
            >
              {open ? (
                <span className="flex h-full flex-col items-center justify-center p-1 text-center">
                  <span className="text-[10px] font-bold opacity-70">{card!.no}</span>
                  <span className="text-[11px] sm:text-xs font-extrabold leading-tight">{card!.en}</span>
                  <span className="mt-1 text-[10px] font-semibold">{card!.th}</span>
                </span>
              ) : (
                <span className="text-2xl text-[#f2c14e]">✦</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-4 min-h-[64px]" aria-live="polite">
        {card ? (
          <>
            <p className="text-sm font-extrabold text-[#f2c14e]">
              {card.en} · {card.th}
            </p>
            <p className="mt-1 text-sm !text-white/90">{card.meaning}</p>
            <button
              type="button"
              onClick={() => {
                setCard(null);
                setPicked(null);
              }}
              className="mt-2 text-xs font-bold underline !text-white/70 hover:!text-white"
            >
              เปิดไพ่ใหม่
            </button>
          </>
        ) : (
          <p className="text-xs !text-white/60">ความหมายของไพ่จะแสดงที่นี่</p>
        )}
      </div>
      <Link href={moreHref} className="mt-auto pt-3 text-xs font-bold !text-[#f2c14e] hover:underline">
        อ่านดูดวงไพ่ทาโรต์ทั้งหมด ›
      </Link>
    </section>
  );
}
