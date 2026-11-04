// Payload CMS data source (CMS_SOURCE=payload). Reads the CMS REST API and
// returns the same shapes the WordPress client returns (WPPost with the
// contents/v1 extras, WPCategory, SidebarPost…), so pages don't change and
// CMS_SOURCE=wordpress still works as a fallback. Cache tags match what the
// CMS sends to /api/revalidate (apps/cms/src/hooks/revalidate.ts).
import { stringify } from "qs-esm";
import { cache } from "react";
import { draftMode } from "next/headers";
import { CMS_URL, MEDIA_URL, SITE_ORIGIN } from "./env";
import type {
  SidebarPost,
  TopTag,
  WPCategory,
  WPFeaturedImage,
  WPImageSize,
  WPPost,
  WPTag,
  WPUser,
} from "./wp";

const REVALIDATE = 900; // 15 min; edits in the CMS refresh the tags right away

type Where = Record<string, unknown>;

type PMedia = {
  id: number;
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  sizes?: Record<string, { url: string; width: number; height: number }> | null;
};
type PCategory = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  seoHeading?: string | null;
  seoContent?: string | null;
  parent?: number | PCategory | null;
};
type PTag = { id: number; name: string; slug: string; postCount?: number | null };
type PUser = { id: number; name: string; slug?: string | null; bio?: string | null; showByline?: boolean | null; avatar?: PMedia | number | null };
type PSeo = {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  noindex?: boolean | null;
  nofollow?: boolean | null;
};
export type PPost = {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  contentHtml?: string | null;
  featuredImage?: PMedia | number | null;
  gallery?: (PMedia | number)[] | null;
  youtubeId?: string | null;
  categories?: (PCategory | number)[] | null;
  primaryCategory?: PCategory | number | null;
  tags?: (PTag | number)[] | null;
  author?: PUser | number | null;
  publishedAt?: string | null;
  updatedAt: string;
  sticky?: boolean | null;
  meta?: PSeo | null;
};
type FindResult<T> = { docs: T[]; totalDocs: number; totalPages: number; page: number };

/** WordPress-shaped post that also carries the CMS SEO fields (Yoast values). */
export type CMSPost = WPPost & { _seo?: PSeo | null };

const LIST_SELECT = {
  title: true,
  slug: true,
  excerpt: true,
  featuredImage: true,
  youtubeId: true,
  categories: true,
  primaryCategory: true,
  tags: true,
  author: true,
  publishedAt: true,
  updatedAt: true,
  sticky: true,
};
const FULL_SELECT = { ...LIST_SELECT, contentHtml: true, gallery: true, meta: true };

const POPULATE = {
  // prefix + filename + variants: the CMS builds `url` and `sizes` from them.
  media: { url: true, filename: true, prefix: true, _objectKey: true, alt: true, width: true, height: true, variants: true, sizes: true },
  categories: { name: true, slug: true, parent: true },
  tags: { name: true, slug: true },
  users: { name: true, slug: true, showByline: true },
};

async function cms<T>(path: string, query: Record<string, unknown>, tags: string[], revalidate = REVALIDATE): Promise<T | null> {
  const qs = stringify(query, { addQueryPrefix: true, encode: true });
  const res = await fetch(`${CMS_URL}/api${path}${qs}`, { next: { revalidate, tags } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`CMS ${res.status}: ${path}${qs}`);
  return (await res.json()) as T;
}

/** Same as `cms`, but a failure renders an empty block instead of an error page. */
async function cmsSafe<T>(path: string, query: Record<string, unknown>, tags: string[], revalidate?: number) {
  try {
    return await cms<T>(path, query, tags, revalidate);
  } catch (err) {
    console.error(`[payload] ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// ---------- mapping ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** WordPress `date` is Bangkok wall time without a zone; `date_gmt` is UTC without a zone. */
const bangkok = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 19);
const utc = (iso: string) => new Date(iso).toISOString().slice(0, 19);
const obj = <T>(v: T | number | null | undefined): T | null => (v && typeof v === "object" ? v : null);
const idOf = (v: { id: number } | number | null | undefined) => (typeof v === "number" ? v : (v?.id ?? 0));
/** WordPress-style percent-encoding (lowercase hex) so paths match the old URLs exactly. */
const encodeSlug = (s: string) => encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function absoluteMediaUrl(url?: string | null) {
  if (!url) return "";
  return url.startsWith("http") ? url : `${CMS_URL}${url}`;
}

/** Body HTML stores library images as `media:{key}`; point them at the R2 domain. */
const resolveContentMedia = (html: string) =>
  html.replace(/(["'(\s])media:([^"')\s]+)/g, (_, pre: string, key: string) => `${pre}${MEDIA_URL || CMS_URL + "/api/media/file"}/${key}`);

function featuredImage(m: PMedia | null): WPFeaturedImage | undefined {
  if (!m) return undefined;
  const sizes: Record<string, WPImageSize> = {};
  for (const [name, s] of Object.entries(m.sizes ?? {}))
    sizes[name] = { ID: m.id, width: s.width, height: s.height, src: absoluteMediaUrl(s.url) };
  if (m.url) sizes.full = { ID: m.id, width: m.width ?? 0, height: m.height ?? 0, src: absoluteMediaUrl(m.url) };
  return { alt: m.alt ?? "", sizes };
}

// Category paths (/parent/child) like WordPress's %category% permalinks.
// Once per request (React cache); across requests the fetch cache (1 h) serves it.
// No module-level promise: Workers must not share I/O between requests.
const allCategories = cache(async (): Promise<PCategory[]> => {
  const res = await cms<FindResult<PCategory>>("/categories", { limit: 500, depth: 0, pagination: false }, ["categories"], 3600);
  return res?.docs ?? [];
});
function categoryPath(c: PCategory, all: PCategory[]): string {
  const parts: string[] = [];
  let cur: PCategory | undefined = c;
  for (let i = 0; cur && i < 5; i++) {
    parts.unshift(encodeSlug(cur.slug));
    const parentId = idOf(cur.parent as PCategory | number | null);
    cur = parentId ? all.find((x) => x.id === parentId) : undefined;
  }
  return parts.join("/");
}

function toWPPost(p: PPost, cats: PCategory[]): CMSPost {
  const primary = obj(p.primaryCategory);
  const postCats = (p.categories ?? []).map((c) => obj(c)).filter((c): c is PCategory => Boolean(c));
  const tags = (p.tags ?? []).map((t) => obj(t)).filter((t): t is PTag => Boolean(t));
  const author = obj(p.author);
  const published = p.publishedAt ?? p.updatedAt;
  const mainCat = primary ?? postCats[0] ?? null;
  const catPath = mainCat ? categoryPath(mainCat, cats) : "news";
  const pathname = `/${catPath}/${encodeSlug(p.slug)}`;
  const authorSlug = author?.slug ? encodeSlug(author.slug) : "";

  return {
    id: p.id,
    date: bangkok(published),
    date_gmt: utc(published),
    modified: bangkok(p.updatedAt),
    modified_gmt: utc(p.updatedAt),
    slug: encodeSlug(p.slug),
    link: `${SITE_ORIGIN}${pathname}`,
    pathname,
    title: { rendered: esc(p.title) },
    excerpt: { rendered: p.excerpt ? esc(p.excerpt) : "" },
    content: { rendered: resolveContentMedia(p.contentHtml ?? "") },
    author: idOf(p.author),
    featured_media: idOf(p.featuredImage),
    featured_image: featuredImage(obj(p.featuredImage)),
    categories: postCats.map((c) => c.id),
    tags: tags.map((t) => t.id),
    primary_category: mainCat
      ? [{ id: mainCat.id, name: mainCat.name, nicename: mainCat.slug, pathname: `/category/${encodeSlug(mainCat.slug)}` }]
      : undefined,
    taxonomies: {
      categories: postCats.map((c) => ({ id: c.id, name: c.name, nicename: c.slug, pathname: `/category/${encodeSlug(c.slug)}` })),
      tags: tags.map((t) => ({ id: t.id, name: t.name, slug: encodeSlug(t.slug), pathname: `/tag/${encodeSlug(t.slug)}` })),
    },
    author_info: author?.showByline
      ? {
          display_name: author.name,
          author_link: authorSlug ? `${SITE_ORIGIN}/author/${authorSlug}` : undefined,
          pathname: authorSlug ? `/author/${authorSlug}` : undefined,
        }
      : undefined,
    gallery_images: (p.gallery ?? [])
      .map((g) => obj(g))
      .filter((g): g is PMedia => Boolean(g))
      .map((g) => ({ id: g.id, alt: g.alt ?? "", sizes: featuredImage(g)?.sizes ?? {} })),
    video: p.youtubeId || null,
    _seo: p.meta ?? null,
  };
}

function toSidebarPost(p: CMSPost): SidebarPost {
  const c = p.primary_category?.[0];
  return {
    id: p.id,
    modified: p.date,
    title: p.title,
    excerpt: p.excerpt,
    author: p.author_info?.display_name ?? "",
    featured_image: p.featured_image,
    primary_category: c ? { id: c.id, name: c.name, slug: c.nicename, pathname: c.pathname } : undefined,
    pathname: p.pathname,
    views: p.views,
  };
}

// ---------- posts ----------

/**
 * "Now" rounded *up* to 5 minutes: keeps fetch URLs cacheable, and a story
 * published a moment ago is included right away (the CMS revalidates on
 * publish). Scheduled stories may appear up to 5 minutes early.
 */
function publishedNow(): Where {
  const t = Math.ceil(Date.now() / 300_000) * 300_000;
  return { publishedAt: { less_than_equal: new Date(t).toISOString() } };
}

const list = (v?: number | number[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export type PostQuery = {
  perPage?: number;
  page?: number;
  categories?: number | number[];
  author?: number | number[];
  tags?: number | number[];
  tagSlug?: string;
  exclude?: number[];
  include?: number[];
  search?: string;
};

export async function findPosts(q: PostQuery): Promise<{ data: CMSPost[]; total: number; totalPages: number }> {
  const and: Where[] = [publishedNow()];
  const cacheTags = ["posts"];
  if (list(q.categories).length) and.push({ categories: { in: list(q.categories) } });
  if (list(q.author).length) and.push({ author: { in: list(q.author) } });
  const tagIds = list(q.tags);
  if (q.tagSlug) {
    const tag = await findTagBySlug(q.tagSlug);
    if (!tag) return { data: [], total: 0, totalPages: 0 };
    tagIds.push(tag.id);
    cacheTags.push(`tag-${tag.slug}`);
  }
  if (tagIds.length) and.push({ tags: { in: tagIds } });
  if (q.exclude?.length) and.push({ id: { not_in: q.exclude } });
  if (q.include?.length) and.push({ id: { in: q.include } });
  // Headline and standfirst (trigram-indexed in Postgres, see the CMS migration).
  if (q.search) and.push({ or: [{ title: { like: q.search } }, { excerpt: { like: q.search } }] });

  const perPage = q.perPage ?? 12;
  const [res, cats] = await Promise.all([
    cmsSafe<FindResult<PPost>>(
      "/posts",
      { where: { and }, limit: perPage, page: q.page ?? 1, sort: "-publishedAt", depth: 1, select: LIST_SELECT, populate: POPULATE },
      cacheTags,
    ),
    allCategories(),
  ]);
  return {
    data: (res?.docs ?? []).map((d) => toWPPost(d, cats)),
    total: res?.totalDocs ?? 0,
    totalPages: res?.totalPages ?? 0,
  };
}

export async function getPosts(q: PostQuery = {}): Promise<WPPost[]> {
  return (await findPosts(q)).data;
}

/** A story by slug; in draft mode (CMS preview) the latest saved version, drafts included. */
export async function getPostBySlug(slug: string): Promise<CMSPost | null> {
  const decoded = safeDecode(slug);
  const preview = await draftMode()
    .then((d) => d.isEnabled)
    .catch(() => false);
  if (preview) return findDraftPostBySlug(decoded);
  const [res, cats] = await Promise.all([
    cms<FindResult<PPost>>(
      "/posts",
      { where: { and: [{ slug: { equals: decoded } }, publishedNow()] }, limit: 1, depth: 1, select: FULL_SELECT, populate: POPULATE },
      ["posts", `post-${decoded}`],
    ),
    allCategories(),
  ]);
  const doc = res?.docs[0];
  return doc ? toWPPost(doc, cats) : null;
}

type PLottery = {
  id: number;
  title: string;
  slug: string;
  drawDate: string;
  publishedAt?: string | null;
  updatedAt: string;
  featuredImage?: PMedia | number | null;
  meta?: PSeo | null;
} & Partial<Record<"firstPrize" | "nearbyFirstPrize" | "first3Prize" | "last3Prize" | "last2Prize" | "secondPrize" | "thirdPrize" | "fourthPrize" | "fifthPrize", string | null>>;

const LOTTERY_ROWS: [keyof PLottery, string][] = [
  ["firstPrize", "รางวัลที่ 1"],
  ["nearbyFirstPrize", "ข้างเคียงรางวัลที่ 1"],
  ["first3Prize", "เลขหน้า 3 ตัว"],
  ["last3Prize", "เลขท้าย 3 ตัว"],
  ["last2Prize", "เลขท้าย 2 ตัว"],
  ["secondPrize", "รางวัลที่ 2"],
  ["thirdPrize", "รางวัลที่ 3"],
  ["fourthPrize", "รางวัลที่ 4"],
  ["fifthPrize", "รางวัลที่ 5"],
];

/** /program/{slug} (TV programme pages) and /lottery/{slug} (draw results), shaped as stories. */
export async function getSpecialBySlug(section: "program" | "lottery", slug: string): Promise<CMSPost | null> {
  const decoded = safeDecode(slug);
  const collection = section === "program" ? "programs" : "lotteries";
  const res = await cms<FindResult<PPost & PLottery>>(
    `/${collection}`,
    { where: { and: [{ slug: { equals: decoded } }, publishedNow()] }, limit: 1, depth: 1, populate: POPULATE },
    [collection, `${section}-${decoded}`],
  );
  const doc = res?.docs[0];
  if (!doc) return null;
  if (section === "lottery") {
    const rows = LOTTERY_ROWS.filter(([k]) => doc[k])
      .map(([k, label]) => `<tr><th>${label}</th><td>${esc(String(doc[k])).replace(/\s+/g, " ")}</td></tr>`)
      .join("");
    doc.contentHtml = `<figure class="wp-block-table"><table><tbody>${rows}</tbody></table></figure>`;
    doc.publishedAt ??= doc.drawDate;
  }
  const post = toWPPost({ ...doc, categories: [], primaryCategory: null }, []);
  post.pathname = `/${section}/${encodeSlug(doc.slug)}`;
  post.link = `${SITE_ORIGIN}${post.pathname}`;
  post.primary_category = undefined;
  return post;
}

/** Static page (WordPress `page`) at /{slug}. */
export async function getPageBySlug(slug: string): Promise<CMSPost | null> {
  const decoded = safeDecode(slug);
  const res = await cmsSafe<FindResult<PPost>>(
    "/pages",
    { where: { slug: { equals: decoded } }, limit: 1, depth: 1, populate: POPULATE },
    ["pages", `page-${decoded}`],
  );
  const doc = res?.docs[0];
  if (!doc) return null;
  const post = toWPPost({ ...doc, categories: [], primaryCategory: null, author: null }, []);
  post.pathname = `/${encodeSlug(doc.slug)}`;
  post.link = `${SITE_ORIGIN}${post.pathname}`;
  post.primary_category = undefined;
  return post;
}

/** Latest saved version of a story (drafts included), for editor previews. Never cached. */
async function findDraftPostBySlug(slug: string): Promise<CMSPost | null> {
  const key = process.env.CMS_PREVIEW_API_KEY;
  if (!key) return null;
  const qs = stringify(
    { where: { slug: { equals: slug } }, draft: true, limit: 1, depth: 1, select: FULL_SELECT, populate: POPULATE },
    { addQueryPrefix: true, encode: true },
  );
  const res = await fetch(`${CMS_URL}/api/posts${qs}`, { cache: "no-store", headers: { authorization: `users API-Key ${key}` } });
  if (!res.ok) return null;
  const doc = ((await res.json()) as FindResult<PPost>).docs[0];
  return doc ? toWPPost(doc, await allCategories()) : null;
}

/** Slug of a story by id (for /?p=ID redirects and previews). */
export async function getPostPathById(id: number): Promise<string | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const [res, cats] = await Promise.all([
    cmsSafe<FindResult<PPost>>(
      "/posts",
      { where: { and: [{ id: { equals: id } }, publishedNow()] }, limit: 1, depth: 1, select: { slug: true, primaryCategory: true, categories: true, updatedAt: true, title: true }, populate: POPULATE },
      ["posts", `post-${id}`],
    ),
    allCategories(),
  ]);
  const doc = res?.docs[0];
  return doc ? (toWPPost(doc, cats).pathname ?? null) : null;
}

// ---------- taxonomies & users ----------

function toWPCategory(c: PCategory): WPCategory {
  return {
    id: c.id,
    count: 0,
    name: c.name,
    slug: encodeSlug(c.slug),
    description: c.description ?? "",
    parent: idOf(c.parent as PCategory | number | null),
    link: `${SITE_ORIGIN}/category/${encodeSlug(c.slug)}`,
    acf: { heading_2: c.seoHeading ?? "", contents: c.seoContent ?? "" },
  };
}

export async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
  const s = safeDecode(slug);
  const c = (await allCategories()).find((x) => x.slug === s);
  return c ? toWPCategory(c) : null;
}

export async function getCategories(perPage = 100): Promise<WPCategory[]> {
  return (await allCategories()).slice(0, perPage).map(toWPCategory);
}

const toWPTag = (t: PTag): WPTag => ({
  id: t.id,
  count: t.postCount ?? 0,
  name: t.name,
  slug: encodeSlug(t.slug),
  link: `${SITE_ORIGIN}/tag/${encodeSlug(t.slug)}`,
});

export async function findTagBySlug(slug: string): Promise<PTag | null> {
  const s = safeDecode(slug);
  const res = await cmsSafe<FindResult<PTag>>("/tags", { where: { slug: { equals: s } }, limit: 1, depth: 0 }, ["tags", `tag-${s}`]);
  return res?.docs[0] ?? null;
}

export async function getPopularTags(perPage = 20): Promise<WPTag[]> {
  const res = await cmsSafe<FindResult<PTag>>("/tags", { sort: "-postCount", limit: perPage, depth: 0 }, ["tags"], 3600);
  return (res?.docs ?? []).map(toWPTag);
}

/** Like contents/v1/top-tags: the tags used most by the latest 60 stories. */
export async function getTopTags(): Promise<TopTag[]> {
  const res = await cmsSafe<FindResult<PPost>>(
    "/posts",
    { where: publishedNow(), limit: 60, sort: "-publishedAt", depth: 1, select: { tags: true }, populate: { tags: { name: true, slug: true } } },
    ["posts"],
  );
  const counts = new Map<number, TopTag>();
  for (const p of res?.docs ?? [])
    for (const t of p.tags ?? []) {
      const tag = obj(t);
      if (!tag) continue;
      const cur = counts.get(tag.id) ?? { id: tag.id, name: tag.name, slug: tag.slug, count: 0 };
      cur.count++;
      counts.set(tag.id, cur);
    }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 20);
}

export async function getUserBySlug(slug: string): Promise<WPUser | null> {
  const s = safeDecode(slug);
  const res = await cmsSafe<FindResult<PUser>>(
    "/users",
    { where: { slug: { equals: s } }, limit: 1, depth: 1, select: { name: true, slug: true, bio: true, avatar: true }, populate: POPULATE },
    ["users"],
    3600,
  );
  const u = res?.docs[0];
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    url: "",
    description: u.bio ?? "",
    slug: encodeSlug(u.slug ?? ""),
    link: `${SITE_ORIGIN}/author/${encodeSlug(u.slug ?? "")}`,
    acf: { author_image: absoluteMediaUrl(obj(u.avatar)?.url) },
  };
}

// ---------- sidebar ----------

/** Related (same tags, then same category), latest and most-viewed stories for an article. */
export async function getArticleSidebar(post: CMSPost, mostview: () => Promise<SidebarPost[]>) {
  const tagIds = (post.tags ?? []).slice(0, 5);
  const catId = post.primary_category?.[0]?.id;
  const [byTag, latest, top] = await Promise.all([
    tagIds.length ? getPosts({ tags: tagIds, exclude: [post.id], perPage: 6 }) : Promise.resolve([]),
    getPosts({ exclude: [post.id], perPage: 10 }),
    mostview(),
  ]);
  let related = byTag;
  if (related.length < 6 && catId) {
    const more = await getPosts({ categories: catId, exclude: [post.id, ...related.map((p) => p.id)], perPage: 6 - related.length });
    related = [...related, ...more];
  }
  return { related: related.map(toSidebarPost), latest: latest.map(toSidebarPost), mostview: top };
}

export async function latestSidebar(n: number): Promise<SidebarPost[]> {
  return (await getPosts({ perPage: n })).map(toSidebarPost);
}

/** Most-viewed stories, given ids in rank order (from the view counter). */
export async function postsByIds(ids: number[]): Promise<SidebarPost[]> {
  if (!ids.length) return [];
  const posts = await getPosts({ include: ids, perPage: ids.length });
  const byId = new Map(posts.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is CMSPost => Boolean(p)).map(toSidebarPost);
}

// ---------- sitemap ----------

export type SitemapRow = { loc: string; lastmod: string };

export async function sitemapPosts(page: number, perPage: number): Promise<{ rows: SitemapRow[]; total: number }> {
  const [res, cats] = await Promise.all([
    cmsSafe<FindResult<PPost>>(
      "/posts",
      {
        where: publishedNow(),
        limit: perPage,
        page,
        sort: "-publishedAt",
        depth: 1,
        select: { slug: true, primaryCategory: true, categories: true, updatedAt: true, publishedAt: true, title: true },
        populate: { categories: { name: true, slug: true, parent: true } },
      },
      ["posts"],
      3600,
    ),
    allCategories(),
  ]);
  return {
    rows: (res?.docs ?? []).map((d) => {
      const p = toWPPost(d, cats);
      return { loc: p.link, lastmod: `${p.modified_gmt}Z` };
    }),
    total: res?.totalDocs ?? 0,
  };
}

export async function sitemapTags(page: number, perPage: number): Promise<{ rows: SitemapRow[]; total: number }> {
  const res = await cmsSafe<FindResult<PTag & { updatedAt: string }>>(
    "/tags",
    { where: { postCount: { greater_than: 0 } }, sort: "-postCount", limit: perPage, page, depth: 0, select: { slug: true, updatedAt: true } },
    ["tags"],
    3600,
  );
  return {
    rows: (res?.docs ?? []).map((t) => ({ loc: `${SITE_ORIGIN}/tag/${encodeSlug(t.slug)}`, lastmod: new Date(t.updatedAt).toISOString() })),
    total: res?.totalDocs ?? 0,
  };
}

export async function sitemapCategories(): Promise<SitemapRow[]> {
  const now = new Date().toISOString();
  return (await allCategories()).map((c) => ({ loc: `${SITE_ORIGIN}/category/${encodeSlug(c.slug)}`, lastmod: now }));
}

export async function sitemapPages(): Promise<SitemapRow[]> {
  const res = await cmsSafe<FindResult<{ slug: string; updatedAt: string }>>(
    "/pages",
    { limit: 200, depth: 0, select: { slug: true, updatedAt: true } },
    ["pages"],
    3600,
  );
  return (res?.docs ?? []).map((p) => ({ loc: `${SITE_ORIGIN}/${encodeSlug(p.slug)}`, lastmod: new Date(p.updatedAt).toISOString() }));
}

export async function sitemapAuthors(): Promise<SitemapRow[]> {
  const res = await cmsSafe<FindResult<PUser & { updatedAt: string }>>(
    "/users",
    { where: { showByline: { equals: true } }, limit: 500, depth: 0, select: { slug: true, updatedAt: true } },
    ["users"],
    3600,
  );
  return (res?.docs ?? [])
    .filter((u) => u.slug)
    .map((u) => ({ loc: `${SITE_ORIGIN}/author/${encodeSlug(u.slug!)}`, lastmod: new Date(u.updatedAt).toISOString() }));
}
