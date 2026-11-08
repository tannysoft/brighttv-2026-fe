import type { CollectionConfig } from 'payload'
import { isAdmin, isAdminField, selfOrAdmin } from '../access'
import { slugFrom } from '../lib/slug'
import { revalidateAfterChange } from '../hooks/revalidate'
import { wpFields } from '../fields/wp-fields'

/**
 * Staff accounts. Also the post author (WordPress `users`): name, slug,
 * bio and avatar are shown as the byline.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'ผู้ใช้', plural: 'ผู้ใช้' },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7,
    useAPIKey: true,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: 'ตั้งค่า',
  },
  hooks: { afterChange: [revalidateAfterChange('users')] },
  access: {
    // Author profiles are public (byline); auth fields are never returned.
    read: () => true,
    create: isAdmin,
    update: selfOrAdmin,
    delete: isAdmin,
    admin: ({ req }) => Boolean(req.user),
  },
  fields: [
    // Overrides the built-in auth email so it's never exposed on public reads.
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      access: { read: ({ req }) => Boolean(req.user) },
    },
    { name: 'name', label: 'ชื่อที่แสดง', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
      hooks: { beforeValidate: [slugFrom('name')] },
    },
    {
      name: 'role',
      label: 'บทบาท',
      type: 'select',
      required: true,
      defaultValue: 'author',
      saveToJWT: true,
      // Roles are internal: hidden from the public API (bylines only need name/slug).
      access: { read: ({ req }) => Boolean(req.user), create: isAdminField, update: isAdminField },
      options: [
        { label: 'ผู้ดูแลระบบ', value: 'admin' },
        { label: 'บรรณาธิการ', value: 'editor' },
        { label: 'ผู้เขียน', value: 'author' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'showByline',
      label: 'แสดงชื่อเป็นผู้เขียนบนหน้าเว็บ',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'ปิดไว้ เว็บจะแสดงผู้เขียนเป็น “กองบรรณาธิการ”',
      },
    },
    { name: 'bio', label: 'ประวัติย่อ', type: 'textarea' },
    { name: 'avatar', label: 'รูปโปรไฟล์', type: 'upload', relationTo: 'media' },
    wpFields,
  ],
}
