import type { CollectionAfterChangeHook, FieldHook } from 'payload'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  IMAGE_SIZES,
  RESIZABLE,
  variantBox,
  variantFile,
  type ImageSizeName,
  type ImageVariants,
} from '@brighttv/shared/image-sizes'
import { mediaFileURL } from '../lib/env'

type MediaDoc = {
  filename?: string | null
  prefix?: string | null
  /** Extra folder segment the storage plugin may add to new uploads. */
  _objectKey?: string | null
  mimeType?: string | null
  width?: number | null
  height?: number | null
  variants?: ImageVariants | null
}

/** The object's folder in R2: prefix + `_objectKey` (same rule as @payloadcms/plugin-cloud-storage). */
const folderOf = (doc: MediaDoc) => [doc.prefix, doc._objectKey].filter(Boolean).join('/')
const storageKey = (folder: string, file: string) => [folder, file].filter(Boolean).join('/')

/** Virtual `sizes`: { name: { url, width, height } } of the stored copies. */
export const sizesAfterRead: FieldHook = ({ data }) => {
  const doc = data as MediaDoc | undefined
  const variants = doc?.variants
  if (!doc?.filename || !variants || typeof variants !== 'object') return null
  return Object.fromEntries(
    Object.entries(variants)
      .filter(([, v]) => v?.file)
      .map(([name, v]) => [name, { url: mediaFileURL(folderOf(doc), v!.file), width: v!.width, height: v!.height }]),
  )
}

type ImagesBinding = {
  input: (s: ReadableStream) => {
    transform: (o: object) => { output: (o: object) => Promise<{ response: () => Response }> }
  }
  info: (s: ReadableStream) => Promise<{ width?: number; height?: number }>
}
type R2Like = {
  get: (k: string) => Promise<{ body: ReadableStream } | null>
  put: (k: string, v: ArrayBuffer, o: object) => Promise<unknown>
}

/**
 * After an upload, write the WordPress-named WebP copies next to the
 * original in R2 with the Cloudflare Images binding (Workers have no sharp).
 */
export const generateVariants: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req, context }) => {
  if (context.skipSizes) return doc
  const d = doc as MediaDoc
  const changedFile =
    operation === 'create' ||
    previousDoc?.filename !== d.filename ||
    previousDoc?.prefix !== d.prefix ||
    previousDoc?._objectKey !== d._objectKey
  if (!changedFile || !d.filename || !RESIZABLE.test(d.mimeType ?? '')) return doc
  try {
    const { env } = await getCloudflareContext({ async: true })
    const images = (env as unknown as { IMAGES?: ImagesBinding }).IMAGES
    const r2 = (env as unknown as { R2: R2Like }).R2
    if (!images) return doc
    const folder = folderOf(d)
    // The storage plugin writes the original to R2 after this hook runs, so
    // use the uploaded bytes; R2 only for re-runs without a file in the request.
    let bytes: Uint8Array<ArrayBuffer> | null = req.file?.data ? new Uint8Array(req.file.data) : null
    if (!bytes) {
      const original = await r2.get(storageKey(folder, d.filename))
      if (!original) return doc
      bytes = new Uint8Array(await new Response(original.body).arrayBuffer())
    }
    let { width, height } = d
    if (!width || !height) ({ width, height } = await images.info(new Blob([bytes]).stream()))
    if (!width || !height) return doc
    const variants: ImageVariants = {}
    await Promise.all(
      (Object.keys(IMAGE_SIZES) as ImageSizeName[]).map(async (name) => {
        const box = variantBox(name, width!, height!)
        if (!box) return
        const file = variantFile(d.filename!, box)
        const out = await images
          .input(new Blob([bytes]).stream())
          .transform({ width: box.width, height: box.height, fit: IMAGE_SIZES[name].crop ? 'cover' : 'scale-down' })
          .output({ format: 'image/webp', quality: 80 })
        await r2.put(storageKey(folder, file), await out.response().arrayBuffer(), {
          httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
        })
        variants[name] = { file, ...box }
      }),
    )
    // Straight to the database: a Local API update would re-upload req.file.
    await req.payload.db.updateOne({ collection: 'media', id: doc.id, data: { variants }, req })
    ;(doc as MediaDoc).variants = variants
  } catch (err) {
    req.payload.logger.warn(`image sizes for media ${doc.id}: ${(err as Error).message}`)
  }
  return doc
}
