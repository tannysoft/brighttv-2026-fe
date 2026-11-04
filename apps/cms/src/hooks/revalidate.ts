import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { WEB_URL } from '../lib/env'
import { isDraftSave } from './draft-save'

/**
 * Tell the website which cached data changed. The website maps these tags
 * onto its fetch cache (see apps/web/src/app/api/revalidate/route.ts).
 * Skipped during bulk imports (`context.disableRevalidate`).
 */
async function notify(tags: string[], req: { payload: { logger: { warn: (m: string) => void } } }) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret || !tags.length) return
  try {
    const res = await fetch(`${WEB_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ tags }),
    })
    if (!res.ok) req.payload.logger.warn(`revalidate ${res.status}: ${tags.join(',')}`)
  } catch (err) {
    req.payload.logger.warn(`revalidate failed: ${(err as Error).message}`)
  }
}

const tagsFor = (collection: string, doc: Record<string, unknown>): string[] => {
  const id = doc.id
  switch (collection) {
    case 'posts':
      return ['posts', `post-${id}`, `post-${doc.slug}`]
    case 'programs':
      return ['programs', `program-${doc.slug}`]
    case 'lotteries':
      return ['lotteries', `lottery-${doc.slug}`]
    case 'positions':
      return ['positions', 'posts']
    case 'pages':
      return ['pages', `page-${doc.slug}`]
    case 'categories':
      return ['categories', 'posts']
    case 'tags':
      return ['tags', `tag-${doc.slug}`]
    default:
      return [collection]
  }
}

export const revalidateAfterChange =
  (collection: string): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, req, context }) => {
    if (context.disableRevalidate || isDraftSave(req)) return doc
    // Nothing public changed: never published before or after this save.
    if (doc._status === 'draft' && previousDoc?._status !== 'published') return doc
    const tags = new Set(tagsFor(collection, doc))
    if (previousDoc?.slug && previousDoc.slug !== doc.slug) tagsFor(collection, previousDoc).forEach((t) => tags.add(t))
    await notify([...tags], req)
    return doc
  }

export const revalidateAfterDelete =
  (collection: string): CollectionAfterDeleteHook =>
  async ({ doc, req, context }) => {
    if (context.disableRevalidate) return doc
    await notify(tagsFor(collection, doc), req)
    return doc
  }
