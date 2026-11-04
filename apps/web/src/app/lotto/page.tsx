import type { Metadata } from "next";
import { getPosts } from "@/lib/wp";
import { getDrawDates, getLatestDraw } from "@/lib/lotto";
import LottoDrawView from "./LottoDrawView";

// New results refresh this page right away (the lottery job revalidates the "lotto" tag).
export const revalidate = 1800;

const LOTTO_CATEGORY_ID = 124708;

export const metadata: Metadata = {
  title: "ตรวจหวย — ผลสลากกินแบ่งรัฐบาลงวดล่าสุด",
  description:
    "ตรวจหวยรัฐบาลงวดล่าสุด พร้อมผลรางวัลที่ 1, เลขท้าย 2 ตัว, เลขหน้า 3 ตัว, เลขท้าย 3 ตัว, รางวัลข้างเคียง และรางวัลที่ 2-5 ครบทุกรางวัล พร้อมผลย้อนหลังและตรวจย้อนหลังทุกงวดจาก BRIGHT TV",
  alternates: { canonical: "/lotto" },
};

export default async function LottoPage() {
  const [draw, dates, lottoPosts] = await Promise.all([
    getLatestDraw(),
    getDrawDates(),
    getPosts({ categories: LOTTO_CATEGORY_ID, perPage: 13 }),
  ]);
  return <LottoDrawView draw={draw} dates={dates} lottoPosts={lottoPosts} latest />;
}
