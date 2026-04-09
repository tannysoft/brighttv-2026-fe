// Format a raw view count (string|number) with thousands separators.
// Returns "" when the value is missing, zero, or not a finite number so
// callers can conditionally render a badge.
export function formatViews(views: string | number | undefined): string {
  if (views == null) return "";
  const n = typeof views === "number" ? views : parseInt(views, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("en-US");
}
