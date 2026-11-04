import type { CollectionConfig, Field } from 'payload'
import { isEditorOrAdmin, publishedOrStaff } from '../access'
import { slugFrom } from '../lib/slug'
import { WEB_URL } from '../lib/env'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'

const prize = (name: string, label: string, description?: string): Field => ({
  name,
  label,
  type: 'text',
  admin: { description: description ?? 'หลายเลขคั่นด้วยเว้นวรรค' },
})

/** WordPress post type `lottery` (government lottery results): /lottery/{slug}. */
export const Lotteries: CollectionConfig = {
  slug: 'lotteries',
  labels: { singular: 'ผลสลาก', plural: 'ผลสลากกินแบ่ง' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'drawDate', '_status'],
    group: 'เนื้อหา',
    preview: (doc) => `${WEB_URL}/lottery/${encodeURIComponent(String(doc.slug ?? ''))}`,
  },
  defaultSort: '-drawDate',
  access: {
    read: publishedOrStaff,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  versions: { drafts: true, maxPerDoc: 10 },
  hooks: {
    afterChange: [revalidateAfterChange('lotteries')],
    afterDelete: [revalidateAfterDelete('lotteries')],
  },
  fields: [
    { name: 'title', label: 'หัวข้อ', type: 'text', required: true },
    {
      name: 'drawDate',
      label: 'งวดวันที่',
      type: 'date',
      required: true,
      index: true,
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } },
    },
    {
      type: 'row',
      fields: [
        prize('firstPrize', 'รางวัลที่ 1', '6 หลัก'),
        prize('nearbyFirstPrize', 'ข้างเคียงรางวัลที่ 1'),
      ],
    },
    {
      type: 'row',
      fields: [prize('first3Prize', 'เลขหน้า 3 ตัว'), prize('last3Prize', 'เลขท้าย 3 ตัว'), prize('last2Prize', 'เลขท้าย 2 ตัว', '2 หลัก')],
    },
    prize('secondPrize', 'รางวัลที่ 2'),
    prize('thirdPrize', 'รางวัลที่ 3'),
    { ...prize('fourthPrize', 'รางวัลที่ 4'), type: 'textarea' } as Field,
    { ...prize('fifthPrize', 'รางวัลที่ 5'), type: 'textarea' } as Field,
    { name: 'featuredImage', label: 'ภาพหน้าปก', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
      hooks: { beforeValidate: [slugFrom('title')] },
    },
    { name: 'tags', label: 'แท็ก', type: 'relationship', relationTo: 'tags', hasMany: true, admin: { position: 'sidebar' } },
    { name: 'publishedAt', label: 'วันที่เผยแพร่', type: 'date', admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
  ],
}
