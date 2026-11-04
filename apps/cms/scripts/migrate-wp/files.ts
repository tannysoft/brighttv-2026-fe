import fs from 'node:fs'
import path from 'node:path'
import type { WordPress, WPMedia } from './wp'

/**
 * Check every WordPress media file against the R2 bucket `brighttv` and upload
 * the ones that are missing. WP Offload Media already put every upload there
 * (key = the cdn.brighttv.co.th path, wp-content/uploads/yyyy/mm/{n}/file),
 * so this is mostly a HEAD per file — run it once to confirm, and after the
 * cutover delta. Originals only: the resized copies are listed per item.
 *
 * The list comes straight from the WordPress API (not the CMS database), so
 * this step can run on its own, even while other steps are importing.
 *
 * R2 access, in order of preference:
 *  - S3 API when R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET are set;
 *  - otherwise the real bucket through your `wrangler login` (the "remote" env in wrangler.jsonc).
 * Progress: checked ids in .migrate/files-done.txt, failures in .migrate/files-failed.tsv.
 */
export type Bucket = {
  label: string
  exists: (key: string) => Promise<boolean>
  put: (key: string, body: ArrayBuffer, contentType: string) => Promise<void>
}

const CACHE = 'public, max-age=31536000, immutable'

export async function openBucket(): Promise<Bucket> {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
    const { S3Client, PutObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3')
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
    return {
      label: `R2 bucket ${R2_BUCKET} (S3 API)`,
      exists: async (Key) => {
        try {
          await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key }))
          return true
        } catch {
          return false
        }
      },
      put: async (Key, body, ContentType) => {
        await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key, Body: new Uint8Array(body), ContentType, CacheControl: CACHE }))
      },
    }
  }

  const { getPlatformProxy } = await import('wrangler')
  const proxy = await getPlatformProxy<{ R2: R2Like }>({
    configPath: path.resolve(import.meta.dirname, '../../wrangler.jsonc'),
    environment: 'remote',
    remoteBindings: true,
    persist: process.env.WRANGLER_PERSIST_TO ? { path: process.env.WRANGLER_PERSIST_TO } : undefined,
  })
  const r2 = proxy.env.R2
  return {
    label: 'R2 bucket brighttv (via wrangler login)',
    exists: async (key) => Boolean(await r2.head(key)),
    put: async (key, body, contentType) => {
      await r2.put(key, body, { httpMetadata: { contentType, cacheControl: CACHE } })
    },
  }
}

type R2Like = {
  head: (k: string) => Promise<unknown>
  put: (k: string, v: ArrayBuffer, o: object) => Promise<unknown>
}

/** Storage key of a WordPress attachment: the path of its public (offloaded) URL. */
export function mediaKey(m: Pick<WPMedia, 'media_details' | 'source_url'>): string | null {
  try {
    const key = decodeURIComponent(new URL(m.source_url).pathname).replace(/^\/+/, '')
    if (key.startsWith('wp-content/uploads/')) return key
  } catch {
    // fall through
  }
  return m.media_details?.file ? `wp-content/uploads/${m.media_details.file}` : null
}

export async function copyFiles(
  wp: WordPress,
  opts: { concurrency: number; workDir: string; since?: string },
) {
  const bucket = await openBucket()
  const doneFile = path.join(opts.workDir, 'files-done.txt')
  const failFile = path.join(opts.workDir, 'files-failed.tsv')
  const done = new Set(fs.existsSync(doneFile) ? fs.readFileSync(doneFile, 'utf8').split('\n').filter(Boolean).map(Number) : [])
  const doneOut = fs.createWriteStream(doneFile, { flags: 'a' })
  const failOut = fs.createWriteStream(failFile, { flags: 'a' })
  console.log(`files → ${bucket.label}; ${done.size} already checked`)

  let present = 0
  let uploaded = 0
  let failed = 0
  let bytes = 0
  const started = Date.now()
  const params = {
    _fields: 'id,source_url,mime_type,media_details',
    ...(opts.since ? { modified_after: opts.since } : {}),
  }

  for await (const { items, page, totalPages } of wp.pages<WPMedia>('/media', params)) {
    const todo = items.filter((m) => !done.has(m.id))
    let i = 0
    await Promise.all(
      Array.from({ length: Math.min(opts.concurrency, todo.length) }, async () => {
        while (i < todo.length) {
          const m = todo[i++]
          const key = mediaKey(m)
          try {
            if (!key) throw new Error('no file path')
            if (await bucket.exists(key)) {
              present++
            } else {
              // Not offloaded: WordPress still serves it from its own disk (no timestamp folder).
              const local = m.media_details?.file ? `wp-content/uploads/${m.media_details.file}` : key
              const url = `${wp.base}/${local.split('/').map(encodeURIComponent).join('/')}`
              const res = await wp.fetch(url, 4)
              if (!res.ok) throw new Error(`${res.status} ${url}`)
              const body = await res.arrayBuffer()
              await bucket.put(key, body, m.mime_type || res.headers.get('content-type') || 'application/octet-stream')
              uploaded++
              bytes += body.byteLength
            }
            doneOut.write(`${m.id}\n`)
          } catch (err) {
            failed++
            failOut.write(`${m.id}\t${key ?? ''}\t${(err as Error).message}\n`)
          }
        }
      }),
    )
    if (page % 10 === 0 || page === totalPages) {
      const mins = (Date.now() - started) / 60000
      console.log(
        `${new Date().toISOString().slice(11, 19)} files page ${page}/${totalPages}: already in bucket ${present}, uploaded ${uploaded} (${(bytes / 1e9).toFixed(2)} GB), failed ${failed} — ${mins.toFixed(1)} min`,
      )
    }
  }
  doneOut.end()
  failOut.end()
  console.log(`files done: already in bucket ${present}, uploaded ${uploaded}, failed ${failed}`)
  if (failed) console.log(`failures in ${failFile} — run the step again to retry them`)
}
