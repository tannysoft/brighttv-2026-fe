// Centralised runtime env reader.
//
// On a plain Node.js / Next dev server values come from `.env.local` via
// `process.env`. On Cloudflare Workers they come from the `vars` block in
// `wrangler.jsonc` (and/or `wrangler secret put` for secrets) — OpenNext
// populates `process.env` from those bindings at Worker startup because we
// enabled the `nodejs_compat_populate_process_env` compat flag, so reading
// `process.env.X` Just Works in both environments.
//
// Use this module as the single source of truth for env values so we can
// centralise defaults, fail-fast on missing required keys, and swap the
// source later (e.g. move to `getCloudflareContext().env`) without touching
// every caller.

function read(name: string, fallback: string): string {
  const raw = process.env[name];
  if (typeof raw === "string" && raw.length > 0) return raw;
  return fallback;
}

// Origin of the WordPress REST API we fetch from. The site URL and the
// API host happen to be the same domain today but are kept as separate
// entries in case Bright eventually hosts the headless front-end on its
// own domain while the WP REST endpoint stays at brighttv.co.th.
export const WP_API_ORIGIN = read(
  "WP_API_ORIGIN",
  "https://www.brighttv.co.th",
);

// Canonical origin of this front-end, used for share URLs, JSON-LD @id,
// OpenGraph metadata, etc.
export const SITE_ORIGIN = read(
  "SITE_ORIGIN",
  "https://www.brighttv.co.th",
);
