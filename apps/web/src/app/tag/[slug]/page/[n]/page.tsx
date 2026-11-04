import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import TagListing, { tagMetadata, tagPath } from "../../TagListing";

export const revalidate = 300;

// Rendered on first request, then cached (ISR).
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string; n: string }> };

/** "2" → 2; "1" → 1 (redirected to the listing); anything else → null (404). */
const pageNumber = (n: string) => (/^[1-9]\d{0,5}$/.test(n) ? Number(n) : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, n } = await params;
  const page = pageNumber(n);
  return page ? tagMetadata(slug, page) : {};
}

export default async function TagPageN({ params }: Props) {
  const { slug, n } = await params;
  const page = pageNumber(n);
  if (page === null) notFound();
  if (page === 1) permanentRedirect(tagPath(slug));
  return <TagListing slug={slug} page={page} />;
}
