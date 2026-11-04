import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPosts } from "@/lib/wp";
import { getDraw, getDrawDates } from "@/lib/lotto";
import { parseDrawSlug, prize, thaiDate } from "@/lib/lotto-check";
import LottoDrawView from "../LottoDrawView";

// Past draws don't change; the lottery job revalidates the "lotto" tag if one does.
export const revalidate = 86400;

const LOTTO_CATEGORY_ID = 124708;

type Props = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const iso = parseDrawSlug((await params).date);
  const draw = iso ? await getDraw(iso) : null;
  if (!draw) return {};
  const label = thaiDate(draw.date);
  const first = prize(draw, "prizeFirst")[0];
  const back2 = prize(draw, "runningNumberBackTwo")[0];
  return {
    title: `ตรวจหวย ${label} ผลสลากกินแบ่งรัฐบาล`,
    description: `ผลสลากกินแบ่งรัฐบาลงวดวันที่ ${label} รางวัลที่ 1 ${first ?? "-"} เลขท้าย 2 ตัว ${back2 ?? "-"} พร้อมรางวัลอื่นครบทุกรางวัล และตรวจเลขของคุณได้ทันที`,
    alternates: { canonical: `/lotto/${(await params).date}` },
  };
}

export default async function LottoDrawPage({ params }: Props) {
  const iso = parseDrawSlug((await params).date);
  if (!iso) notFound();
  const [draw, dates, lottoPosts] = await Promise.all([
    getDraw(iso),
    getDrawDates(),
    getPosts({ categories: LOTTO_CATEGORY_ID, perPage: 13 }),
  ]);
  if (!draw) notFound();
  return <LottoDrawView draw={draw} dates={dates} lottoPosts={lottoPosts} latest={false} />;
}
