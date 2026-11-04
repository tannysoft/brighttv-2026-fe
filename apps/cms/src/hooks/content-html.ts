import type { CollectionBeforeChangeHook } from 'payload'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { collectMediaIds, lexicalToHTML, type MediaLite } from '../lib/lexical-html'

/**
 * Store the rendered HTML of the body next to the Lexical JSON, so the
 * website reads ready-made HTML instead of converting on every request.
 * The WordPress import passes `context.skipContentHtml` with HTML it already built.
 */
export const renderContentHtml: CollectionBeforeChangeHook = async ({ data, req, context }) => {
  if (context.skipContentHtml || !data.content) return data
  const state = data.content as SerializedEditorState
  const ids = collectMediaIds(state)
  const media = new Map<number, MediaLite>()
  if (ids.length) {
    const found = await req.payload.find({
      collection: 'media',
      where: { id: { in: ids } },
      limit: ids.length,
      depth: 0,
      pagination: false,
      req,
    })
    found.docs.forEach((m) => media.set(m.id as number, m as unknown as MediaLite))
  }
  data.contentHtml = lexicalToHTML(state, media)
  return data
}
