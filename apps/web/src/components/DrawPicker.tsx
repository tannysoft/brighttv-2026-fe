"use client";

import { useRouter } from "next/navigation";
import { drawSlug, thaiDate } from "@/lib/lotto-check";

/** Jump to any stored draw. */
export default function DrawPicker({ dates, current }: { dates: string[]; current: string | null }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--bt-navy)]">
      เลือกงวด
      <select
        value={current ?? ""}
        onChange={(e) => e.target.value && router.push(`/lotto/${drawSlug(e.target.value)}`)}
        className="h-10 rounded-lg border border-[var(--bt-line)] bg-white px-3 text-sm font-semibold text-[var(--bt-text)]"
      >
        {!current && <option value="">—</option>}
        {dates.map((d) => (
          <option key={d} value={d}>
            {thaiDate(d)}
          </option>
        ))}
      </select>
    </label>
  );
}
