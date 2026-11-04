// Data for the /horoscope page. Tag ids are WordPress tag ids (kept by the
// Payload import). Short numerology texts are general meanings for
// entertainment — the horoscope desk can edit them here.

export const HOROSCOPE_TAGS = {
  daily: 49249, // ดวงรายวัน
  weekly: 62972, // ดวงรายสัปดาห์
  monthly: 60891, // ดวงรายเดือน
  tarot: 111365, // ดูดวงไพ่ทาโรต์
  luckyColor: 69038, // สีมงคล
  love: 45544, // ดวงความรัก
  money: 70558, // ดวงการเงิน
} as const;

export type Zodiac = { tag: number; name: string; symbol: string; en: string };

export const ZODIACS: Zodiac[] = [
  { tag: 63699, name: "ราศีเมษ", symbol: "♈", en: "Aries" },
  { tag: 54351, name: "ราศีพฤษภ", symbol: "♉", en: "Taurus" },
  { tag: 41518, name: "ราศีเมถุน", symbol: "♊", en: "Gemini" },
  { tag: 65069, name: "ราศีกรกฎ", symbol: "♋", en: "Cancer" },
  { tag: 63700, name: "ราศีสิงห์", symbol: "♌", en: "Leo" },
  { tag: 41242, name: "ราศีกันย์", symbol: "♍", en: "Virgo" },
  { tag: 54352, name: "ราศีตุลย์", symbol: "♎", en: "Libra" },
  { tag: 54354, name: "ราศีพิจิก", symbol: "♏", en: "Scorpio" },
  { tag: 54353, name: "ราศีธนู", symbol: "♐", en: "Sagittarius" },
  { tag: 54350, name: "ราศีมังกร", symbol: "♑", en: "Capricorn" },
  { tag: 54358, name: "ราศีกุมภ์", symbol: "♒", en: "Aquarius" },
  { tag: 54362, name: "ราศีมีน", symbol: "♓", en: "Pisces" },
];

/** Traditional colour of each day of birth (สีประจำวันเกิด). */
export type DayColor = { key: string; day: string; color: string; hex: string };
export const DAY_COLORS: DayColor[] = [
  { key: "sun", day: "วันอาทิตย์", color: "สีแดง", hex: "#d62828" },
  { key: "mon", day: "วันจันทร์", color: "สีเหลือง", hex: "#f2c200" },
  { key: "tue", day: "วันอังคาร", color: "สีชมพู", hex: "#e85d9c" },
  { key: "wed", day: "วันพุธ (กลางวัน)", color: "สีเขียว", hex: "#2a9d4b" },
  { key: "wedn", day: "วันพุธ (กลางคืน)", color: "สีเทา", hex: "#6b7280" },
  { key: "thu", day: "วันพฤหัสบดี", color: "สีส้ม", hex: "#f08a24" },
  { key: "fri", day: "วันศุกร์", color: "สีฟ้า", hex: "#3a9ad9" },
  { key: "sat", day: "วันเสาร์", color: "สีม่วง", hex: "#7b3fa0" },
];
/** Day colour for a JS weekday (0 = Sunday). */
export const dayColorOf = (weekday: number): DayColor => {
  const key = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][weekday];
  return DAY_COLORS.find((d) => d.key === key) ?? DAY_COLORS[0];
};

/** Life-path number (1–9) traits. */
export const NUMEROLOGY: Record<number, { title: string; text: string }> = {
  1: { title: "ผู้นำ", text: "มุ่งมั่น เป็นตัวของตัวเอง กล้าตัดสินใจ เหมาะกับการบุกเบิกสิ่งใหม่" },
  2: { title: "ผู้ประสาน", text: "อ่อนโยน เข้าใจคนอื่น ทำงานเป็นทีมเก่ง เป็นที่รักของคนรอบตัว" },
  3: { title: "นักสร้างสรรค์", text: "ช่างพูด มีเสน่ห์ ไอเดียเยอะ เหมาะกับงานสื่อสารและงานศิลปะ" },
  4: { title: "นักวางระบบ", text: "ขยัน มีระเบียบ เชื่อถือได้ ค่อย ๆ สร้างความมั่นคงทีละขั้น" },
  5: { title: "นักผจญภัย", text: "รักอิสระ ปรับตัวเก่ง ชอบการเดินทางและการเปลี่ยนแปลง" },
  6: { title: "ผู้ดูแล", text: "รับผิดชอบ ห่วงใยครอบครัวและคนรอบข้าง เป็นที่พึ่งของคนอื่น" },
  7: { title: "นักคิด", text: "ลึกซึ้ง ช่างสังเกต ชอบหาความรู้ เชื่อในเหตุผลและสัญชาตญาณ" },
  8: { title: "นักบริหาร", text: "มุ่งความสำเร็จ เก่งเรื่องเงินและการจัดการ มีพลังผลักดันสูง" },
  9: { title: "ผู้ให้", text: "ใจกว้าง เสียสละ ชอบช่วยเหลือผู้อื่น มองโลกในภาพกว้าง" },
};

/** Sum the digits of a birth date (day + month + year) down to 1–9. */
export function lifePath(day: number, month: number, year: number): number {
  let n = [day, month, year].join("").split("").reduce((s, d) => s + Number(d), 0);
  while (n > 9) n = String(n).split("").reduce((s, d) => s + Number(d), 0);
  return n;
}
