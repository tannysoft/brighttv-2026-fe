/** Public base URL of the website (used for previews and cache revalidation). */
export const WEB_URL = (process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '')

/**
 * Public base URL of the R2 media bucket `brighttv` (custom domain
 * https://cdn.brighttv.co.th). When unset, files are served through
 * Payload's own /api/media/file route.
 */
export const MEDIA_URL = (process.env.MEDIA_URL || '').replace(/\/$/, '')

export const mediaFileURL = (prefix: string | null | undefined, filename: string) => {
  const key = [prefix, filename].filter(Boolean).join('/')
  const path = key.split('/').map(encodeURIComponent).join('/')
  return MEDIA_URL ? `${MEDIA_URL}/${path}` : `/api/media/file/${encodeURIComponent(filename)}`
}
