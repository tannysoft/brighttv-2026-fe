import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { parsePageParam } from "@/lib/utils";
import { categoryPath, pagePath } from "@/lib/categories";
import CategoryListing, { listingMetadata, loadCategory } from "@/components/CategoryListing";

// The "lotto" news category (its plain path /lotto is the results page).
// Further pages: /lotto/news/page/N (app/[...slug]).
export const revalidate = 300;

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const src = await loadCategory("lotto");
  return src ? listingMetadata(src, 1) : {};
}

export default async function LottoNewsPage({ searchParams }: Props) {
  const q = (await searchParams).page;
  if (q !== undefined) permanentRedirect(pagePath(categoryPath("lotto"), parsePageParam(q) ?? 1));
  const src = await loadCategory("lotto");
  if (!src) notFound();
  return <CategoryListing src={src} page={1} />;
}
