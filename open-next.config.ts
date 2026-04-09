// OpenNext configuration for the Cloudflare Workers adapter.
// Every overrider is pulled from `@opennextjs/cloudflare` so the built Worker
// uses Cloudflare-native primitives (KV for the ISR cache, R2 for tag cache
// if enabled, Workers fetch for image loading, etc.).
//
// Docs: https://opennext.js.org/cloudflare/get-started
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

export default defineCloudflareConfig({
  // Use the KV namespace bound as NEXT_INC_CACHE_KV (see wrangler.jsonc).
  // If the binding is absent at runtime OpenNext silently falls back to an
  // in-memory cache — perfect for a first-time deploy before you've created
  // the KV namespace.
  incrementalCache: kvIncrementalCache,

  // Uncomment when you have an R2 bucket bound as NEXT_TAG_CACHE_R2 and
  // want fine-grained on-demand revalidation via `revalidateTag()`.
  // tagCache: r2TagCache,

  // Uncomment to dedupe concurrent cache revalidations via Durable Objects.
  // queue: doQueue,
});
