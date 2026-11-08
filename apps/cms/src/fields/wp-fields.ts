import type { Field } from 'payload'

/**
 * Custom fields carried over from WordPress (raw ACF values and other post /
 * user / term meta) that have no field of their own here yet. Written by the
 * import (scripts/migrate-wp), read-only in the admin. When a value gets a
 * real field, the import moves it there and drops it from this object.
 */
export const wpFields: Field = {
  name: 'wpFields',
  label: 'ข้อมูลเดิมจาก WordPress',
  type: 'json',
  // Raw meta can hold internal notes or personal details: logged-in staff only.
  access: { read: ({ req }) => Boolean(req.user) },
  admin: {
    readOnly: true,
    position: 'sidebar',
    condition: (data) => Boolean(data?.wpFields && Object.keys(data.wpFields).length),
    description: 'Custom field จากเว็บเดิมที่ยังไม่มีช่องของตัวเอง (อ่านอย่างเดียว)',
  },
}
