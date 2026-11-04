/**
 * WordPress search URLs (/?s=q, rewritten here by next.config.ts) → /search?q=q.
 * A route rather than a config redirect: those carry the original query (`s`) over.
 */
export function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("s") ?? "").trim();
  const location = q ? `/search?${new URLSearchParams({ q })}` : "/search";
  return new Response(null, { status: 301, headers: { location, "Cache-Control": "public, s-maxage=86400" } });
}
