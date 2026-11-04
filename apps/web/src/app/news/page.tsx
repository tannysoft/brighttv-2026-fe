import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { parsePageParam } from "@/lib/utils";
import { pagePath } from "@/lib/categories";
import CategoryListing, { LATEST_PATH, listingMetadata } from "@/components/CategoryListing";

// "ข่าวล่าสุด": every story, newest first. Short cache: this is the page that
// competes for "ข่าววันนี้ / ข่าวล่าสุด". (/news/page/N and /news/{sub}/… are
// handled by app/[...slug].)
export const revalidate = 60;

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  return listingMetadata({ kind: "latest" }, 1);
}

export default async function LatestNewsPage({ searchParams }: Props) {
  // Old ?page=N links → /news/page/N
  const q = (await searchParams).page;
  if (q !== undefined) permanentRedirect(pagePath(LATEST_PATH, parsePageParam(q) ?? 1));
  return <CategoryListing src={{ kind: "latest" }} page={1} />;
}
