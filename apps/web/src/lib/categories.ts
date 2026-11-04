// Curated category navigation for the redesigned Bright TV site.
// IDs match brighttv.co.th WP REST API.

export type NavCategory = {
  id: number;
  slug: string; // WordPress slug; page URL = categoryPath(slug)
  name: string;
  accent?: string; // tailwind class
};

export const PRIMARY_NAV: NavCategory[] = [
  { id: 24972, slug: "news", name: "ข่าวล่าสุด" },
  { id: 8, slug: "politics", name: "การเมือง" },
  { id: 3, slug: "social", name: "สังคม" },
  { id: 7, slug: "crime", name: "อาชญากรรม" },
  { id: 3810, slug: "economy", name: "เศรษฐกิจ" },
  { id: 5, slug: "entertain", name: "บันเทิง" },
  { id: 76653, slug: "global", name: "ต่างประเทศ" },
  { id: 9, slug: "sports", name: "กีฬา" },
  { id: 7466, slug: "lifestyle", name: "ไลฟ์สไตล์" },
  { id: 91633, slug: "health", name: "สุขภาพ" },
  { id: 14322, slug: "horoscope", name: "ดูดวง" },
];

// Sections shown on the homepage
export const HOMEPAGE_SECTIONS: NavCategory[] = [
  { id: 8, slug: "politics", name: "การเมือง" },
  { id: 3810, slug: "economy", name: "เศรษฐกิจ" },
  { id: 5, slug: "entertain", name: "บันเทิง" },
  { id: 7, slug: "crime", name: "อาชญากรรม" },
  { id: 76653, slug: "global", name: "ต่างประเทศ" },
  { id: 9, slug: "sports", name: "กีฬา" },
  { id: 7466, slug: "lifestyle", name: "ไลฟ์สไตล์" },
  { id: 91633, slug: "health", name: "สุขภาพ" },
];

export function findNavBySlug(slug: string): NavCategory | undefined {
  return PRIMARY_NAV.find((c) => c.slug === slug);
}

// ---------- category URLs ----------
// Category pages live at the same path WordPress used under /category/,
// minus that prefix: /news/politics (articles are /news/politics/{slug}).
// No imports here: next.config.ts reads this file for the old-URL redirects.

/** Parent of each sub-category (WordPress hierarchy, decoded slugs). Top-level ones are absent. */
export const CATEGORY_PARENT: Record<string, string> = {
  social: "news",
  politics: "news",
  crime: "news",
  global: "news",
  economy: "news",
  local: "news",
  sports: "news",
  royal: "news",
  korea: "entertain",
  "move-to-do": "entertain",
  "highlight-youtube": "hot-clip",
  playbig: "special-interview",
  "ป๋าแหง็ม-ครับเจ้านาย": "bright-news",
  "ไบรท์เช็คแล้ว": "bright-news",
  "ไบรท์อาสา": "bright-news",
  "ประมวลภาพ": "rama9",
  "สกู๊ปพิเศษ": "rama9",
  "พระบรมราโชวาท": "rama9",
  "โครงการของพ่อ": "rama9",
};

/** Categories whose page isn't at their plain path. */
const CATEGORY_PATH_OVERRIDE: Record<string, string> = {
  // /lotto is the lottery results page; its news list sits under it.
  lotto: "/lotto/news",
  // Grouped under news; its stories keep their /entertain/{slug} URLs.
  entertain: "/news/entertain",
};

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
/** Percent-encode like WordPress (lowercase hex). */
const encode = (s: string) => encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());

/** URL path of a category page, e.g. "politics" → "/news/politics". Accepts encoded or decoded slugs. */
export function categoryPath(slug: string): string {
  const s = decode(slug);
  if (CATEGORY_PATH_OVERRIDE[s]) return CATEGORY_PATH_OVERRIDE[s];
  const chain = [s];
  for (let p = CATEGORY_PARENT[s]; p && chain.length < 5; p = CATEGORY_PARENT[p]) chain.unshift(p);
  return "/" + chain.map(encode).join("/");
}

/** "/category/entertain/korea" (WordPress pathname) → "/entertain/korea". */
export function categoryPathFromWP(pathname: string | undefined, slug: string): string {
  const s = decode(slug);
  if (CATEGORY_PATH_OVERRIDE[s]) return CATEGORY_PATH_OVERRIDE[s];
  const p = pathname?.replace(/^https?:\/\/[^/]+/, "").replace(/^\/category(?=\/)/, "").replace(/\/$/, "");
  return p && p !== "/category" ? p : categoryPath(slug);
}

/**
 * The category a URL path points at, or null. Multi-segment paths only match
 * known sub-categories at their exact path (so /news/politics is the category,
 * /news/politics/{slug} an article). Single segments are left to the caller.
 */
export function categoryFromSegments(segments: string[]): string | null {
  if (segments.length < 2) return null;
  const asked = "/" + segments.map(decode).join("/");
  for (const [slug, path] of Object.entries(CATEGORY_PATH_OVERRIDE)) if (decode(path) === asked) return slug;
  const leaf = decode(segments[segments.length - 1]);
  if (!CATEGORY_PARENT[leaf]) return null;
  return decode(categoryPath(leaf)) === asked ? leaf : null;
}

/** Legacy WordPress URLs of a category: /category/{slug} and /category/{parent}/…/{slug}. */
export function legacyCategoryPaths(slug: string): string[] {
  const s = decode(slug);
  const chain = [s];
  for (let p = CATEGORY_PARENT[s]; p && chain.length < 5; p = CATEGORY_PARENT[p]) chain.unshift(p);
  const full = "/category/" + chain.map(encode).join("/");
  const short = "/category/" + encode(s);
  return full === short ? [full] : [full, short];
}

/** WordPress categories with ASCII slugs, for the old-URL redirects in next.config.ts. */
export const REDIRECT_CATEGORY_SLUGS = [
  "news", "entertain", "social-news", "social", "politics", "crime", "bright-news", "hot-clip", "horoscope",
  "global", "highlight-youtube", "korea", "lifestyle", "lotto", "shakenews", "economy", "health", "local",
  "sports", "pr", "covid19", "special-reports", "rama9", "technology", "food", "election-62", "news-scoop",
  "playbig", "infographic-news", "net-idol", "royal-coronation", "special-interview", "move-to-do", "travel",
  "belive", "royal", "the-space", "social-clip", "thuppraden", "mr-banthung", "series", "zodiac", "jobs", "fashion",
];

/** RSS URL of a category (by its plain path, so "lotto" is /feed/lotto). */
export function categoryFeedPath(slug: string): string {
  const s = decode(slug);
  const chain = [s];
  for (let p = CATEGORY_PARENT[s]; p && chain.length < 5; p = CATEGORY_PARENT[p]) chain.unshift(p);
  return "/feed/" + chain.map(encode).join("/");
}

/** Old /category/… URLs (page N, feed, plain) → new paths, one hop each. */
export function categoryRedirects() {
  return REDIRECT_CATEGORY_SLUGS.flatMap((s) =>
    legacyCategoryPaths(s).flatMap((old) => [
      { source: `${old}/page/:n(\\d+)`, destination: `${categoryPath(s)}/page/:n`, permanent: true },
      { source: `${old}/feed`, destination: categoryFeedPath(s), permanent: true },
      { source: old, destination: categoryPath(s), permanent: true },
    ]),
  );
}

/**
 * Split a listing URL into its base and page number: [..., "page", "3"] →
 * { base: [...], page: 3 }. page 1 / non-numbers return page null (the
 * caller redirects /page/1 to the base).
 */
export function splitPage(segments: string[]): { base: string[]; page: number | null; paged: boolean } {
  const n = segments.length;
  if (n >= 2 && segments[n - 2] === "page" && /^\d+$/.test(segments[n - 1])) {
    const page = Number(segments[n - 1]);
    return { base: segments.slice(0, -2), page: page >= 2 ? page : null, paged: true };
  }
  return { base: segments, page: 1, paged: false };
}

/** URL of page `n` of a listing at `path` (page 1 = the path itself). */
export const pagePath = (path: string, n: number) => (n > 1 ? `${path}/page/${n}` : path);
