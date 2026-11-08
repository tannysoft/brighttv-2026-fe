import type { CollectionConfig } from 'payload'
import { isEditorOrAdmin, publishedOrStaff } from '../access'
import { articleEditor } from '../lib/editor'
import { slugFrom } from '../lib/slug'
import { WEB_URL } from '../lib/env'
import { renderContentHtml } from '../hooks/content-html'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { wpFields } from '../fields/wp-fields'

/** WordPress post type `program` (TV programme pages): /program/{slug}. */
export const Programs: CollectionConfig = {
  slug: 'programs',
  labels: { singular: 'รายการ', plural: 'รายการทีวี' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['featuredImage', 'title', 'publishedAt', '_status'],
    group: 'เนื้อหา',
    listSearchableFields: ['title', 'slug'],
    preview: (doc) => `${WEB_URL}/program/${encodeURIComponent(String(doc.slug ?? ''))}`,
  },
  defaultSort: '-publishedAt',
  access: {
    read: publishedOrStaff,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  versions: { drafts: true, maxPerDoc: 25 },
  hooks: {
    beforeChange: [renderContentHtml],
    afterChange: [revalidateAfterChange('programs')],
    afterDelete: [revalidateAfterDelete('programs')],
  },
  fields: [
    {
      name: 'title',
      label: 'ชื่อตอน / หัวข้อ',
      type: 'text',
      required: true,
      admin: { components: { Cell: '/components/admin/CoverCell#TitleCell' } },
    },
    {
      name: 'featuredImage',
      label: 'ภาพหน้าปก',
      type: 'upload',
      relationTo: 'media',
      admin: { components: { Cell: '/components/admin/CoverCell#CoverCell' } },
    },
    { name: 'content', label: 'เนื้อหา', type: 'richText', editor: articleEditor },
    { name: 'excerpt', label: 'เกริ่นนำ', type: 'textarea' },
    { name: 'contentHtml', type: 'textarea', admin: { hidden: true } },
    { name: 'dailyOnAir', label: 'ออกอากาศ', type: 'text', admin: { description: 'เช่น จันทร์–ศุกร์ 18.00 น.' } },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
      hooks: { beforeValidate: [slugFrom('title')] },
    },
    {
      name: 'publishedAt',
      label: 'วันที่เผยแพร่',
      type: 'date',
      index: true,
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'positions', label: 'ตำแหน่งบนหน้าเว็บ', type: 'relationship', relationTo: 'positions', hasMany: true, admin: { position: 'sidebar' } },
    { name: 'author', label: 'ผู้เขียน', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar' } },
    wpFields,
  ],
}
