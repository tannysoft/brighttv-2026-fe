import type { MetadataRoute } from "next";
import { SITE_NOINDEX, SITE_ORIGIN } from "@/lib/env";

// Read at request time: SITE_NOINDEX is a runtime var on the preview host.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (SITE_NOINDEX) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // /_next/ stays crawlable: Google needs the JS/CSS to render pages.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: [`${SITE_ORIGIN}/sitemap_index.xml`, `${SITE_ORIGIN}/news-sitemap.xml`],
  };
}
