import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'
import { generateVariants, sizesAfterRead } from '../hooks/image-sizes'

/**
 * Images and files (WordPress `attachment`). Stored in the R2 bucket
 * `brighttv` (cdn.brighttv.co.th) under the key WP Offload Media used:
 * `wp-content/uploads/{yyyy}/{mm}/{timestamp}/{filename}` — the folder part
 * is the `prefix`. Resized WebP copies sit next to each original; their
 * names are kept in `variants` (imported from WordPress, or written by the
 * upload hook). Payload's own imageSizes need sharp, which Workers don't have.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'สื่อ', plural: 'คลังสื่อ' },
  admin: {
    defaultColumns: ['filename', 'alt', 'createdAt'],
    group: 'เนื้อหา',
    listSearchableFields: ['filename', 'alt'],
  },
  access: {
    read: () => true,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        // A replaced file needs new copies before `sizes` points at them.
        if (operation === 'update' && data.filename && data.filename !== originalDoc?.filename) data.variants = null
        // New uploads go to a year/month folder, like WordPress.
        if (operation === 'create' && !data.prefix) {
          const now = new Date()
          const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
          data.prefix = `wp-content/uploads/${now.getUTCFullYear()}/${mm}`
        }
        return data
      },
    ],
    afterChange: [generateVariants],
  },
  fields: [
    { name: 'alt', label: 'ข้อความแทนภาพ (alt)', type: 'text' },
    { name: 'caption', label: 'คำบรรยายภาพ', type: 'textarea' },
    { name: 'credit', label: 'เครดิตภาพ', type: 'text' },
    {
      // { thumbnail: { file, width, height }, … } — files in the same folder.
      // Empty until the copies exist; the website then shows the original.
      name: 'variants',
      type: 'json',
      admin: { hidden: true },
    },
    {
      // URLs of the copies, for the API and the website.
      name: 'sizes',
      type: 'json',
      virtual: true,
      admin: { hidden: true },
      hooks: { afterRead: [sizesAfterRead] },
    },
  ],
  upload: {
    mimeTypes: ['image/*', 'application/pdf', 'video/mp4'],
    // WordPress reuses filenames; the folder (prefix) tells them apart.
    filenameCompoundIndex: ['filename', 'prefix'],
    // Not supported on Workers (no sharp).
    crop: false,
    focalPoint: false,
  },
}
