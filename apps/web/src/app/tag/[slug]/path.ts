// URL helpers for tag pages (shared by the listing and the feed).

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** WordPress-style slug: percent-encoded with lowercase hex (%e0%b8…). */
export function wpSlug(slug: string): string {
  return encodeURIComponent(safeDecode(slug)).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
}

export const tagPath = (slug: string) => `/tag/${wpSlug(slug)}`;
