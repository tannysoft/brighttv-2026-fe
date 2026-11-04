"use client";

import { useEffect, useState } from "react";

const SIZES = [0, 1, 2] as const;
const SCALE: Record<number, string> = {
  0: "100%",
  1: "112.5%",
  2: "125%",
};

export default function FontSizeControl({ className = "" }: { className?: string }) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const saved = Number(localStorage.getItem("bt-font-size") || "0");
    const lv = SIZES.includes(saved as 0 | 1 | 2) ? saved : 0;
    setLevel(lv);
    document.documentElement.style.fontSize = SCALE[lv];
  }, []);

  const apply = (next: number) => {
    const lv = Math.max(0, Math.min(2, next));
    setLevel(lv);
    document.documentElement.style.fontSize = SCALE[lv];
    try {
      localStorage.setItem("bt-font-size", String(lv));
    } catch {}
  };

  return (
    <div
      className={`inline-flex items-center gap-1 px-1 ${className}`}
      role="group"
      aria-label="ขนาดตัวอักษร"
      title="ปรับขนาดตัวอักษร"
    >
      <button
        type="button"
        onClick={() => apply(level - 1)}
        disabled={level === 0}
        aria-label="ลดขนาดตัวอักษร"
        title="ลดขนาดตัวอักษร"
        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[var(--bt-navy)] hover:bg-[var(--bt-bg)] disabled:opacity-30 disabled:cursor-not-allowed text-[13px] font-bold transition-colors"
      >
        A−
      </button>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`block w-1.5 h-1.5 rounded-full ${
              i <= level ? "bg-[var(--bt-red)]" : "bg-[var(--bt-line)]"
            }`}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => apply(level + 1)}
        disabled={level === 2}
        aria-label="เพิ่มขนาดตัวอักษร"
        title="เพิ่มขนาดตัวอักษร"
        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[var(--bt-navy)] hover:bg-[var(--bt-bg)] disabled:opacity-30 disabled:cursor-not-allowed text-[15px] font-bold transition-colors"
      >
        A+
      </button>
    </div>
  );
}
