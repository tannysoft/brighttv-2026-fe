import type { NextConfig } from "next";
import type { Redirect } from "next/dist/lib/load-custom-routes";

// During local `wrangler dev` / `cf:preview` the Cloudflare runtime is
// available to server components via `getCloudflareContext()`. Importing
// this init module is a no-op in production Workers but makes the bindings
// (KV, R2, etc.) reachable during local dev. Safe to leave in place.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { categoryRedirects } from "./src/lib/categories";
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Trailing slashes are stripped by the last redirect below instead of first,
  // so an old URL with a slash (/lottery/01-08-2564/) reaches its target in ONE
  // hop (a redirect source already matches with an optional trailing slash).
  skipTrailingSlashRedirect: true,

  async redirects() {
    const rules: Redirect[] = [
      // Media links from the old site → the R2 domain (same keys).
      {
        source: "/wp-content/uploads/:path*",
        destination: "https://cdn.brighttv.co.th/wp-content/uploads/:path*",
        permanent: true,
      },
      // (WordPress search /?s=… → /search?q=… is a rewrite to /api/wp-search,
      // because a redirect here would also carry `s` over.)
      // Old category URLs → the category's own path (/category/news/politics → /news/politics),
      // incl. /page/N and /feed. Unknown ones fall through to app/category/[...path].
      ...categoryRedirects(),
      { source: "/category/:path+/page/:n(\\d+)", destination: "/category/:path+?page=:n", permanent: true },
      { source: "/category/:path+/feed", destination: "/feed/:path+", permanent: true },
      // (Tag/author pagination /tag/{slug}/page/N is a route; ?page=N redirects there from the page.)
      // Old WordPress lottery posts: /lottery/01-08-2564 → that draw; others → latest.
      { source: "/lottery/:d(\\d{2}-\\d{2}-\\d{4})", destination: "/lotto/:d", permanent: true },
      { source: "/lottery/:slug*", destination: "/lotto", permanent: true },
      { source: "/lottery-sitemap.xml", destination: "/lotto-sitemap.xml", permanent: true },
      // Other WordPress URLs.
      { source: "/page/:n(\\d+)", destination: "/", permanent: true }, // home pagination
      { source: "/home", destination: "/", permanent: true },
      { source: "/comments/feed", destination: "/feed", permanent: true },
      // Post-type archive of TV programmes: no listing here.
      { source: "/programs", destination: "/", permanent: true },
      { source: "/:path+/amp", destination: "/:path+", permanent: true },
    ];
    return [
      ...rules,
      // Any other trailing slash → without (Next's default, see skipTrailingSlashRedirect).
      { source: "/:path+/", destination: "/:path+", permanent: true },
    ];
  },

  // Rewrite sitemap .xml URLs to path-based API routes (query params
  // get stripped by beforeFiles rewrites, so we use path segments instead).
  async rewrites() {
    return {
      beforeFiles: [
        // (beforeFiles: the home page would match first otherwise)
        // WordPress short links: /?p=123 → /api/goto/123 → 301 to the story.
        { source: "/", has: [{ type: "query", key: "p", value: "(?<p>\\d+)" }], destination: "/api/goto/:p" },
        // WordPress search: /?s=q → /api/wp-search → 301 to /search?q=q (without `s`).
        { source: "/", has: [{ type: "query", key: "s" }], destination: "/api/wp-search" },
        { source: "/news-sitemap.xml", destination: "/api/sitemap/news-sitemap" },
        { source: "/lotto-sitemap.xml", destination: "/api/sitemap/lotto-sitemap" },
        { source: "/sitemap.xml", destination: "/api/sitemap/index" },
        { source: "/sitemap_index.xml", destination: "/api/sitemap/index" },
        { source: "/post-sitemap.xml", destination: "/api/sitemap/post-sitemap" },
        { source: "/post-sitemap:n.xml", destination: "/api/sitemap/post-sitemap:n" },
        { source: "/category-sitemap.xml", destination: "/api/sitemap/category-sitemap" },
        { source: "/post_tag-sitemap.xml", destination: "/api/sitemap/post_tag-sitemap" },
        { source: "/post_tag-sitemap:n.xml", destination: "/api/sitemap/post_tag-sitemap:n" },
        { source: "/page-sitemap.xml", destination: "/api/sitemap/page-sitemap" },
        { source: "/author-sitemap.xml", destination: "/api/sitemap/author-sitemap" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },


  // CDN cache headers — Cloudflare respects `s-maxage` for edge caching.
  // Without these, every request triggers full SSR (~1.5-2.6s). With them,
  // Cloudflare serves cached HTML for most visitors (~50ms TTFB).
  async headers() {
    // When several rules match a path and set the same key, the LAST one
    // wins — so the generic catch-all comes first and specific paths after.
    return [
      {
        // Article and other pages: longer cache since content rarely changes.
        // (Not /api, nor feeds/sitemaps, which set their own Cache-Control.)
        source: "/:path((?!api/|_next/)(?!.*\\.xml$)(?!(?:.*/)?feed$).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        // Homepage: short cache since content changes frequently
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        // Latest news: short cache, it competes for "ข่าววันนี้ / ข่าวล่าสุด"
        source: "/news",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        // Tag pages (the feed sets its own)
        source: "/tag/:slug",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
          },
        ],
      },
      // API responses (views, revalidate, preview, goto) are never shared-cached.
      // (Sitemaps are rewritten to /api/sitemap but matched by their public .xml URL.)
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },

  // next/image: skip Next's built-in optimizer. cdn.brighttv.co.th already
  // serves WebP at multiple sizes generated by WP, and enabling the Next
  // optimizer on Workers requires a Cloudflare Images binding (hence the
  // `env.IMAGES binding is not defined` warning in wrangler tail). With
  // `unoptimized: true`, <Image> renders a plain <img> pointing at the
  // upstream URL — no /_next/image route, no IMAGES binding needed.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "cdn.brighttv.co.th" },
      { protocol: "https", hostname: "www.brighttv.co.th" },
      { protocol: "https", hostname: "brighttv.co.th" },
      { protocol: "https", hostname: "secure.gravatar.com" },
    ],
  },
};

export default nextConfig;
