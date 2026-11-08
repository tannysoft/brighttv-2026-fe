import type { CollectionConfig } from 'payload'
import { ownPostsOrEditor, publishedOrStaff, isStaff } from '../access'
import { articleEditor } from '../lib/editor'
import { slugFrom } from '../lib/slug'
import { WEB_URL } from '../lib/env'
import { postPath } from '../lib/paths'
import { renderContentHtml } from '../hooks/content-html'
import { revalidateAfterChange, revalidateAfterDelete } from '../hooks/revalidate'
import { updateTagCounts, updateTagCountsOnDelete } from '../hooks/tag-counts'
import { wpFields } from '../fields/wp-fields'

/**
 * News stories and articles (WordPress `post`). Imported stories keep their
 * WordPress post id as the document id. URLs are /{category}/{slug}.
 */
export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'ข่าว / บทความ', plural: 'ข่าว / บทความ' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['featuredImage', 'title', 'primaryCategory', 'author', 'publishedAt', '_status'],
    group: 'เนื้อหา',
    listSearchableFields: ['title', 'slug'],
    pagination: { defaultLimit: 25 },
    // Opens the story on the website in draft mode (apps/web/src/app/api/preview).
    preview: (doc) =>
      process.env.PREVIEW_SECRET
        ? `${WEB_URL}/api/preview?id=${doc.id}&secret=${encodeURIComponent(process.env.PREVIEW_SECRET)}`
        : `${WEB_URL}${postPath(doc as never)}`,
  },
  defaultSort: '-publishedAt',
  access: {
    read: publishedOrStaff,
    create: isStaff,
    update: ownPostsOrEditor,
    delete: ownPostsOrEditor,
  },
  versions: {
    drafts: { autosave: { interval: 3000 } },
    maxPerDoc: 25,
  },
  hooks: {
    beforeChange: [
      renderContentHtml,
      ({ data, originalDoc, req, operation }) => {
        // Partial updates (bulk publish/edit, PATCH) don't resend every field:
        // fall back to the stored values before filling defaults.
        if (!data.publishedAt && !originalDoc?.publishedAt && data._status === 'published')
          data.publishedAt = new Date().toISOString()
        if (operation === 'create' && !data.author && req.user) data.author = req.user.id
        // The first category is the primary one unless an editor picked another.
        const primary = data.primaryCategory ?? originalDoc?.primaryCategory
        const categories = (data.categories ?? originalDoc?.categories) as unknown[] | undefined
        if (!primary && Array.isArray(categories) && categories.length) data.primaryCategory = categories[0]
        return data
      },
    ],
    afterChange: [updateTagCounts, revalidateAfterChange('posts')],
    afterDelete: [updateTagCountsOnDelete, revalidateAfterDelete('posts')],
  },
  fields: [
    {
      name: 'title',
      label: 'หัวข้อข่าว',
      type: 'text',
      required: true,
      // The cover is the first list column; keep the title clickable too.
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
    {
      name: 'gallery',
      label: 'แกลเลอรีภาพ',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: { description: 'แสดงเป็นอัลบั้มท้ายเนื้อหา' },
    },
    {
      name: 'youtubeId',
      label: 'YouTube video ID',
      type: 'text',
      admin: { description: 'เช่น dQw4w9WgXcQ — แสดงวิดีโอแทนภาพหน้าปก' },
    },
    {
      name: 'excerpt',
      label: 'เกริ่นนำ / สรุปย่อ',
      type: 'textarea',
      admin: { description: 'แสดงในรายการข่าวและใช้เป็นคำอธิบายเมื่อไม่ได้กรอก SEO' },
    },
    // Rendered body for the website; rebuilt from `content` on every save.
    { name: 'contentHtml', type: 'textarea', admin: { hidden: true } },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'ส่วนท้ายของ URL: /{หมวดหลัก}/{slug} — เปลี่ยนแล้วลิงก์เดิมจะใช้ไม่ได้' },
      hooks: { beforeValidate: [slugFrom('title')] },
    },
    {
      name: 'publishedAt',
      label: 'วันที่เผยแพร่',
      type: 'date',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime', displayFormat: 'd MMM yyyy HH:mm' },
        description: 'ตั้งเป็นเวลาในอนาคตเพื่อตั้งเวลาเผยแพร่',
      },
    },
    {
      name: 'categories',
      label: 'หมวดหมู่',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'primaryCategory',
      label: 'หมวดหลัก (ใช้ใน URL)',
      type: 'relationship',
      relationTo: 'categories',
      index: true,
      admin: { position: 'sidebar', description: 'เว้นว่าง = ใช้หมวดแรก' },
    },
    {
      name: 'tags',
      label: 'แท็ก',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'positions',
      label: 'ตำแหน่งบนหน้าเว็บ',
      type: 'relationship',
      relationTo: 'positions',
      hasMany: true,
      admin: { position: 'sidebar', description: 'เช่น Slide 1–5, Sticky' },
    },
    { name: 'author', label: 'ผู้เขียน', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar' } },
    {
      name: 'sticky',
      label: 'ปักหมุด',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'format',
      label: 'รูปแบบ',
      type: 'select',
      defaultValue: 'standard',
      options: [
        { label: 'มาตรฐาน', value: 'standard' },
        { label: 'วิดีโอ', value: 'video' },
        { label: 'แกลเลอรี', value: 'gallery' },
      ],
      admin: { position: 'sidebar' },
    },
    wpFields,
  ],
}
