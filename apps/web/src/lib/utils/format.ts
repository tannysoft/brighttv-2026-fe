// Format a raw view count (string|number) with thousands separators.
// Returns "" when the value is missing, zero, or not a finite number so
// callers can conditionally render a badge.
export function formatViews(views: string | number | undefined): string {
  if (views == null) return "";
  const n = typeof views === "number" ? views : parseInt(views, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("en-US");
}

// ---------- listing pagination ----------

/**
 * `?page=` → page number. Missing → 1; anything that isn't a positive
 * integer ("abc", "0", "1.5", repeated params) → null (callers 404).
 */
export function parsePageParam(raw: string | string[] | undefined): number | null {
  if (raw === undefined || raw === "") return 1;
  if (typeof raw !== "string" || !/^[1-9]\d{0,5}$/.test(raw)) return null;
  return Number(raw);
}

/**
 * Listing whose first page shows `firstSize` items and later pages `size`
 * (category/author: hero + side grid on page 1). Returns the offset/limit
 * of `page` and the page count for `total` items, so pages never overlap.
 */
export function listingWindow(page: number, firstSize: number, size: number) {
  const offset = page === 1 ? 0 : firstSize + (page - 2) * size;
  const limit = page === 1 ? firstSize : size;
  const totalPages = (total: number) =>
    total <= firstSize ? 1 : 1 + Math.ceil((total - firstSize) / size);
  return { offset, limit, totalPages };
}
