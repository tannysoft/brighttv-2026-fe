// Lottery and horoscope data come from the brighttv-data worker (apps/data),
// read over HTTP like the CMS: through the DATA_API service binding when the
// site runs on Workers, and over its public URL elsewhere (`next build`,
// `next dev`), so pages built at deploy already have the data.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { DATA_API_URL } from "./env";

type Fetcher = { fetch: (input: string, init?: RequestInit) => Promise<Response> };

async function binding(): Promise<Fetcher | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as { DATA_API?: Fetcher }).DATA_API ?? null;
  } catch {
    return null; // not running on Workers (build / dev)
  }
}

/** JSON at `path`, or null on 404. Throws on any other failure, so callers'
 *  caches (unstable_cache) never store a missing answer. */
export async function dataApi<T>(path: string): Promise<T | null> {
  const svc = await binding();
  const url = `${DATA_API_URL}${path}`;
  const res = svc ? await svc.fetch(url) : await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`data api ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}
