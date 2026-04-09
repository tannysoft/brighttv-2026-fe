// Thai date + relative time formatting helpers.

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

// Format an ISO date string in Thai with Buddhist-era year. `short` swaps
// to abbreviated months; `withTime` appends the 24h clock separated by a
// middle dot for readability.
export function thaiDate(
  iso: string,
  opts: { withTime?: boolean; short?: boolean } = {},
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const months = opts.short ? THAI_MONTHS_SHORT : THAI_MONTHS;
  const month = months[d.getMonth()];
  const year = d.getFullYear() + 543;
  const base = `${day} ${month} ${year}`;
  if (!opts.withTime) return base;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${base} · ${hh}:${mm} น.`;
}

// Relative timestamp for cards. Only within the last 8 hours we show a
// "X ชั่วโมง/นาทีที่แล้ว" label — beyond that the absolute short Thai date
// with time is more informative than an increasingly vague "3 days ago".
export function timeAgoTH(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "เมื่อสักครู่";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 8) return `${hr} ชั่วโมงที่แล้ว`;
  return thaiDate(iso, { short: true, withTime: true });
}
