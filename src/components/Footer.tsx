import Image from "next/image";
import Link from "next/link";
import { PRIMARY_NAV } from "@/lib/categories";

export default function Footer() {
  return (
    <footer className="mt-16 bg-[var(--bt-navy)] text-white">
      <div className="mx-auto max-w-[1240px] px-4 py-12 grid gap-10 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Image src="/logo-inverse.svg" alt="Bright TV" width={200} height={48} className="h-12 w-auto" />
          <p className="mt-4 text-sm text-white/75 leading-relaxed">
            สำนักข่าวไบรท์ทีวี นำเสนอข่าวสารทันทุกสถานการณ์ ครบทุกประเด็น
            ทั้งข่าวการเมือง สังคม เศรษฐกิจ บันเทิง ต่างประเทศ และไลฟ์สไตล์
            ที่คนไทยเข้าถึงง่าย เชื่อถือได้
          </p>
        </div>

        <div>
          <h4 className="text-white font-bold mb-4 text-base">หมวดหมู่ข่าว</h4>
          <ul className="grid grid-cols-2 gap-y-2 text-sm text-white/80">
            {PRIMARY_NAV.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="hover:text-[var(--bt-red)] transition-colors">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-4 text-base">เกี่ยวกับเรา</h4>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link href="/about" className="hover:text-[var(--bt-red)]">เกี่ยวกับ Bright TV</Link></li>
            <li><Link href="/contact" className="hover:text-[var(--bt-red)]">ติดต่อกองบรรณาธิการ</Link></li>
            <li><Link href="/advertise" className="hover:text-[var(--bt-red)]">ฝ่ายโฆษณา</Link></li>
            <li><Link href="/privacy" className="hover:text-[var(--bt-red)]">นโยบายความเป็นส่วนตัว</Link></li>
            <li><Link href="/terms" className="hover:text-[var(--bt-red)]">ข้อกำหนดการใช้งาน</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-4 text-base">ติดตามเรา</h4>
          <div className="flex gap-3 flex-wrap">
            <a href="https://www.facebook.com/BrightTVOfficialMedia" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[var(--bt-red)] flex items-center justify-center transition-colors" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.8c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5V12h2.6l-.4 2.9h-2.2v7A10 10 0 0 0 22 12"/></svg>
            </a>
            <a href="https://x.com/BrightTVth" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[var(--bt-red)] flex items-center justify-center transition-colors" aria-label="X (Twitter)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2H21l-6.522 7.45L22 22h-6.094l-4.77-6.231L5.7 22H3l7.013-8.01L2 2h6.245l4.31 5.696L18.244 2zm-1.07 18h1.687L7.01 4H5.198L17.174 20z"/></svg>
            </a>
            <a href="https://www.youtube.com/brighttv20" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[var(--bt-red)] flex items-center justify-center transition-colors" aria-label="YouTube">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19.1 4.6 12 4.6 12 4.6s-7.1 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.8.5 8.9.5 8.9.5s7.1 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.5.5-3.2.5-4.8s-.1-3.3-.5-4.8M9.8 15.4V8.6l5.9 3.4z"/></svg>
            </a>
            <a href="https://www.instagram.com/brighttv" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[var(--bt-red)] flex items-center justify-center transition-colors" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <a href="https://www.tiktok.com/@brighttv" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[var(--bt-red)] flex items-center justify-center transition-colors" aria-label="TikTok">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 2h-3v13.4a3.1 3.1 0 1 1-2.2-3v-3a6.1 6.1 0 1 0 5.2 6V9.4a8 8 0 0 0 4.6 1.4V7.8a4.7 4.7 0 0 1-4.6-5.8"/></svg>
            </a>
          </div>
          <p className="mt-6 text-xs text-white/60">รับชมสด ทุกที่ ทุกเวลา</p>
          <Link href="/category/hot-clip" className="mt-2 inline-flex items-center gap-2 px-4 h-10 rounded-full bg-[var(--bt-red)] hover:bg-[var(--bt-red-600)] !text-white text-sm font-bold transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><rect x="2" y="6" width="14" height="12" rx="2" ry="2" /><path d="m22 8-6 4 6 4V8z" /></svg>
            ดูวิดีโอ BRIGHT TV
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[1240px] px-4 py-5 text-center text-xs text-white/60">
          © {new Date().getFullYear()} BRIGHT TV — สงวนลิขสิทธิ์ทุกประการ
        </div>
      </div>
    </footer>
  );
}
