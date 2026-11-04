// Data for the /horoscope page. Tag ids are WordPress tag ids (kept by the
// Payload import). Short texts (tarot, numerology) are general meanings for
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

export type TarotCard = { no: number; en: string; th: string; meaning: string };
/** The 22 major arcana, upright meanings. */
export const TAROT: TarotCard[] = [
  { no: 0, en: "The Fool", th: "คนโง่", meaning: "การเริ่มต้นใหม่ อิสระ กล้าลองสิ่งที่ไม่เคยทำ" },
  { no: 1, en: "The Magician", th: "นักมายากล", meaning: "ความสามารถพร้อม ลงมือทำได้เลย สิ่งที่ตั้งใจมีโอกาสสำเร็จ" },
  { no: 2, en: "The High Priestess", th: "นักบวชหญิง", meaning: "ฟังเสียงภายใน เชื่อสัญชาตญาณ มีเรื่องที่ยังไม่ถูกเปิดเผย" },
  { no: 3, en: "The Empress", th: "จักรพรรดินี", meaning: "ความอุดมสมบูรณ์ ความรักความอบอุ่น งานสร้างสรรค์ไปได้ดี" },
  { no: 4, en: "The Emperor", th: "จักรพรรดิ", meaning: "ความมั่นคง ความเป็นผู้นำ วางแผนอย่างมีระเบียบ" },
  { no: 5, en: "The Hierophant", th: "พระสังฆราช", meaning: "คำแนะนำจากผู้ใหญ่ การเรียนรู้ ทำตามแบบแผนจะปลอดภัย" },
  { no: 6, en: "The Lovers", th: "คนรัก", meaning: "ความรักและความสัมพันธ์ มีเรื่องต้องเลือกด้วยใจ" },
  { no: 7, en: "The Chariot", th: "รถศึก", meaning: "ความมุ่งมั่นพาไปสู่ชัยชนะ การเดินทางหรือก้าวไปข้างหน้า" },
  { no: 8, en: "Strength", th: "พลัง", meaning: "ความอดทนและความกล้า ใช้ความนุ่มนวลชนะใจคน" },
  { no: 9, en: "The Hermit", th: "ฤๅษี", meaning: "เวลาทบทวนตัวเอง หาความสงบ คำตอบอยู่ข้างใน" },
  { no: 10, en: "Wheel of Fortune", th: "กงล้อแห่งโชคชะตา", meaning: "จังหวะชีวิตกำลังเปลี่ยน โชคหมุนเข้าหา" },
  { no: 11, en: "Justice", th: "ความยุติธรรม", meaning: "ความถูกต้องและสมดุล ตัดสินใจด้วยเหตุผล" },
  { no: 12, en: "The Hanged Man", th: "คนแขวน", meaning: "ช่วงรอคอย ลองมองจากมุมใหม่แล้วจะเห็นทาง" },
  { no: 13, en: "Death", th: "ความตาย", meaning: "สิ่งเก่าจบลงเพื่อเริ่มต้นสิ่งใหม่ การเปลี่ยนแปลงครั้งใหญ่" },
  { no: 14, en: "Temperance", th: "ความพอดี", meaning: "ความสมดุล ใจเย็น ค่อยเป็นค่อยไปจะได้ผลดี" },
  { no: 15, en: "The Devil", th: "ปีศาจ", meaning: "ระวังสิ่งล่อใจและสิ่งที่ยึดติด อย่าหลงกับสิ่งที่ง่ายเกินไป" },
  { no: 16, en: "The Tower", th: "หอคอย", meaning: "เรื่องไม่คาดฝัน เตรียมรับมือการเปลี่ยนแปลงฉับพลัน" },
  { no: 17, en: "The Star", th: "ดวงดาว", meaning: "ความหวังและแรงบันดาลใจ สิ่งดี ๆ กำลังมา" },
  { no: 18, en: "The Moon", th: "ดวงจันทร์", meaning: "ความไม่แน่นอน อย่าเพิ่งด่วนสรุป ระวังข้อมูลที่ไม่ชัดเจน" },
  { no: 19, en: "The Sun", th: "ดวงอาทิตย์", meaning: "ความสุข ความสำเร็จ พลังบวกเต็มเปี่ยม" },
  { no: 20, en: "Judgement", th: "การพิพากษา", meaning: "โอกาสครั้งใหม่ ได้รับผลจากสิ่งที่ทำมา" },
  { no: 21, en: "The World", th: "โลก", meaning: "ความสมบูรณ์ เป้าหมายสำเร็จ ปิดจบอย่างสวยงาม" },
];

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
