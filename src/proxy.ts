import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Expose the current pathname to server components via a request header.
// The root layout reads this header to generate per-page JSON-LD inside <head>.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);
  headers.set("x-url-path", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    // All pages except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|api/).*)",
  ],
};
