import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-24 text-center">
      <p className="text-7xl font-extrabold text-[var(--bt-navy)]">404</p>
      <h1 className="mt-4 text-2xl font-bold text-[var(--bt-text)]">ไม่พบหน้าที่คุณต้องการ</h1>
      <p className="mt-2 text-[var(--bt-muted)]">บทความหรือหน้านี้อาจถูกลบ หรือลิงก์ไม่ถูกต้อง</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center h-11 px-6 rounded-full bg-[var(--bt-red)] text-white font-bold hover:bg-[var(--bt-red-600)]"
      >
        กลับหน้าแรก
      </Link>
    </div>
  );
}
