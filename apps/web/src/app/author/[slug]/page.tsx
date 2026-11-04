import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { parsePageParam } from "@/lib/utils";
import { pagePath } from "@/lib/categories";
import AuthorListing, { authorMetadata, authorPath } from "./AuthorListing";

// Page 2+ lives at /author/{slug}/page/{n} (./page/[n]).
export const revalidate = 600;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return authorMetadata(slug, 1);
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  // Old ?page=N links → /author/{slug}/page/N
  const q = (await searchParams).page;
  if (q !== undefined) permanentRedirect(pagePath(authorPath(slug), parsePageParam(q) ?? 1));
  return <AuthorListing slug={slug} page={1} />;
}
