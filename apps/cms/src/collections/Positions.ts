import type { CollectionConfig } from 'payload'
import { isEditorOrAdmin } from '../access'
import { slugFrom } from '../lib/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

/** WordPress taxonomy `position`: homepage slots (Slide 1–5, Sticky, Fixed…). */
export const Positions: CollectionConfig = {
  slug: 'positions',
  labels: { singular: 'ตำแหน่ง', plural: 'ตำแหน่งบนหน้าเว็บ' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug'], group: 'เนื้อหา' },
  access: {
    read: () => true,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  hooks: {
    afterChange: [revalidateAfterChange('positions')],
    afterDelete: [revalidateAfterDelete('positions')],
  },
  fields: [
    { name: 'name', label: 'ชื่อ', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
      hooks: { beforeValidate: [slugFrom('name')] },
    },
  ],
}
