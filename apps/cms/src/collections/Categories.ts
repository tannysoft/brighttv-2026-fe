import type { CollectionConfig } from 'payload'
import { isEditorOrAdmin } from '../access'
import { slugFrom } from '../lib/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { wpFields } from '../fields/wp-fields'

/** WordPress `category`. Page: /category/{slug}; stories: /{slug}/{postSlug}. */
export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'หมวดหมู่', plural: 'หมวดหมู่' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'order', 'showInMenu'],
    group: 'เนื้อหา',
  },
  defaultSort: 'order',
  access: {
    read: () => true,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  hooks: {
    afterChange: [revalidateAfterChange('categories')],
    afterDelete: [revalidateAfterDelete('categories')],
  },
  fields: [
    { name: 'name', label: 'ชื่อ', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'ใช้เป็น URL เช่น /category/politics' },
      hooks: { beforeValidate: [slugFrom('name')] },
    },
    {
      name: 'description',
      label: 'คำอธิบาย (ส่วนบนของหน้าหมวด)',
      type: 'textarea',
      admin: { description: 'ใส่ HTML ได้ เช่น <h1>…</h1>' },
    },
    {
      name: 'seoHeading',
      label: 'หัวข้อเนื้อหา SEO (ท้ายหน้าหมวด)',
      type: 'text',
    },
    {
      name: 'seoContent',
      label: 'เนื้อหา SEO (ท้ายหน้าหมวด)',
      type: 'textarea',
      admin: { description: 'ใส่ HTML ได้' },
    },
    { name: 'parent', label: 'หมวดแม่', type: 'relationship', relationTo: 'categories', admin: { position: 'sidebar' } },
    { name: 'order', label: 'ลำดับในเมนู', type: 'number', defaultValue: 100, admin: { position: 'sidebar' } },
    { name: 'showInMenu', label: 'แสดงในเมนู', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
    {
      name: 'noindex',
      label: 'ไม่ให้ search engine เก็บหน้าหมวดนี้',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'เช่น หมวดที่ใช้จัดหน้าเว็บเท่านั้น' },
    },
    wpFields,
  ],
}
