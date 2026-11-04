import { permanentRedirect } from "next/navigation";
import { categoryPath, pagePath } from "@/lib/categories";
import { parsePageParam } from "@/lib/utils";

// Old WordPress category URLs (/category/news/politics, /category/politics)
// → the category's own path. Known categories are already redirected in
// next.config.ts (one hop); this catches the rest.
export default async function OldCategoryUrl({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { path } = await params;
  const page = parsePageParam((await searchParams).page);
  const to = categoryPath(path[path.length - 1]);
  permanentRedirect(pagePath(to, page ?? 1));
}
