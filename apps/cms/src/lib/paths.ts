/**
 * Website paths. Stories live at /{category}/{slug} (WordPress permalinks);
 * the website finds a story by its slug alone, so any category segment works.
 */
type WithSlug = { slug?: string | null; primaryCategory?: unknown }

const categorySlug = (c: unknown) =>
  c && typeof c === 'object' && 'slug' in c && typeof (c as { slug?: unknown }).slug === 'string'
    ? (c as { slug: string }).slug
    : 'news'

export const postPath = (doc: WithSlug) => `/${categorySlug(doc.primaryCategory)}/${encodeURIComponent(doc.slug ?? '')}`
