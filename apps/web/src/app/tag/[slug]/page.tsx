import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { parsePageParam } from "@/lib/utils";
import { pagePath } from "@/lib/categories";
import TagListing, { tagMetadata, tagPath } from "./TagListing";

// Page 2+ lives at /tag/{slug}/page/{n} (./page/[n]).
export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return tagMetadata(slug, 1);
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  // Old ?page=N links → /tag/{slug}/page/N
  const q = (await searchParams).page;
  if (q !== undefined) permanentRedirect(pagePath(tagPath(slug), parsePageParam(q) ?? 1));
  return <TagListing slug={slug} page={1} />;
}
