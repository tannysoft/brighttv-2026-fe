import type { MetadataRoute } from "next";
import { SITE_NOINDEX, SITE_ORIGIN } from "@/lib/env";

// Read at request time: SITE_NOINDEX is a runtime var on the preview host.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (SITE_NOINDEX) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/_next/"] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
