import type { WPMedia } from './wp'

/**
 * Folder + file of an attachment, from its public URL — WP Offload Media's key
 * (wp-content/uploads/2026/11/03192249/file.webp), which is the R2 object key.
 */
export function mediaLocation(m: Pick<WPMedia, 'source_url' | 'media_details'>) {
  let key: string | undefined
  try {
    key = decodeURIComponent(new URL(m.source_url).pathname).replace(/^\/+/, '')
  } catch {
    key = undefined
  }
  if (!key?.startsWith('wp-content/uploads/')) key = m.media_details?.file ? `wp-content/uploads/${m.media_details.file}` : key
  if (!key) return null
  const slash = key.lastIndexOf('/')
  return { prefix: slash > 0 ? key.slice(0, slash) : '', filename: key.slice(slash + 1) }
}
