/**
 * Resized copies of library images. The names and dimensions are the ones
 * WordPress registered on brighttv.co.th, so the ~660k imported images keep
 * using the copies WordPress already wrote to R2 (`{name}-{w}x{h}.webp`
 * next to the original) and the website asks for the same names before and
 * after the move. New uploads get the same set from the CMS (Cloudflare
 * Images binding, apps/cms/src/hooks/image-sizes.ts).
 *
 * `crop: true` = exact box (cover); otherwise fit inside, never upscale.
 */
export const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150, crop: true },
  'list-thumbnail': { width: 180, height: 114, crop: true },
  medium: { width: 300, height: 300, crop: false },
  'post-thumbnail': { width: 350, height: 184, crop: true },
  medium_large: { width: 768, height: 0, crop: false },
  slide: { width: 768, height: 378, crop: true },
  large: { width: 1024, height: 1024, crop: false },
  '1536x1536': { width: 1536, height: 1536, crop: false },
} as const

export type ImageSizeName = keyof typeof IMAGE_SIZES

/** One stored copy: file name (same folder as the original) and its size. */
export type ImageVariant = { file: string; width: number; height: number }
export type ImageVariants = Partial<Record<ImageSizeName | string, ImageVariant>>

/** Formats we resize; anything else (GIF, SVG, PDF…) is served as the original. */
export const RESIZABLE = /^image\/(jpeg|png|webp|avif)$/

/** Output box of a size for an original of `w`×`h` (null = not needed, original is smaller). */
export function variantBox(name: ImageSizeName, w: number, h: number): { width: number; height: number } | null {
  const s = IMAGE_SIZES[name]
  if (s.crop) {
    if (w < s.width && h < s.height) return null
    return { width: Math.min(s.width, w), height: Math.min(s.height, h) }
  }
  const maxW = s.width || Infinity
  const maxH = s.height || Infinity
  const scale = Math.min(maxW / w, maxH / h, 1)
  if (scale >= 1) return null
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

/** WordPress naming: photo.jpg → photo-300x157.webp */
export function variantFile(filename: string, box: { width: number; height: number }) {
  return `${filename.replace(/\.[^.]+$/, '')}-${box.width}x${box.height}.webp`
}
