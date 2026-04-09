"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PRIMARY_NAV } from "@/lib/categories";
import { thaiDate } from "@/lib/utils";
import FontSizeControl from "./FontSizeControl";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [today, setToday] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setToday(thaiDate(new Date().toISOString()));
    let ticking = false;
    let isScrolled = window.scrollY > 140;
    setScrolled(isScrolled);
    const update = () => {
      const y = window.scrollY;
      // Hysteresis to prevent flip-flopping at the boundary:
      // enter compact at >140, leave compact at <60.
      if (!isScrolled && y > 140) {
        isScrolled = true;
        setScrolled(true);
      } else if (isScrolled && y < 60) {
        isScrolled = false;
        setScrolled(false);
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock scroll when mobile menu open
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [menuOpen]);

  return (
    <>
      <header
        data-scrolled={scrolled ? "true" : "false"}
        className="sticky top-0 z-40 bg-white shadow-[0_1px_0_0_var(--bt-line)] group/header"
      >
        {/* Brand row — desktop: collapses on scroll. Mobile: this is the only visible row */}
        <div className="overflow-hidden transition-[max-height,opacity,padding] duration-300 max-h-[88px] opacity-100 md:group-data-[scrolled=true]/header:max-h-0 md:group-data-[scrolled=true]/header:opacity-0">
          <div className="mx-auto max-w-[1240px] px-4 py-3 md:py-4 flex items-center gap-3 md:gap-6">
            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label="เมนู"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="md:hidden w-10 h-10 -ml-1 rounded-full hover:bg-[var(--bt-bg)] flex items-center justify-center text-[var(--bt-navy)]"
            >
              <MenuIcon />
            </button>

            <Link href="/" className="shrink-0">
              <Image
                src="/logo.svg"
                alt="Bright TV"
                width={220}
                height={52}
                priority
                className="h-8 md:h-10 w-auto"
              />
            </Link>

            <form action="/search" className="hidden md:flex flex-1 max-w-[520px] ml-auto items-center bg-[var(--bt-bg)] rounded-full pl-4 pr-1 h-11 border border-[var(--bt-line)] focus-within:border-[var(--bt-navy)] transition-colors">
              <SearchIcon />
              <input
                type="search"
                name="q"
                placeholder="ค้นหาข่าว..."
                className="bg-transparent outline-none flex-1 px-3 text-sm text-[var(--bt-text)] placeholder:text-[var(--bt-muted)]"
              />
              <button type="submit" className="h-9 px-4 rounded-full bg-[var(--bt-navy)] text-white text-sm font-semibold hover:bg-[var(--bt-navy-700)] transition-colors">
                ค้นหา
              </button>
            </form>

            <div className="md:hidden ml-auto flex items-center gap-1">
              <Link
                href="/search"
                aria-label="ค้นหา"
                className="w-10 h-10 rounded-full hover:bg-[var(--bt-bg)] flex items-center justify-center text-[var(--bt-navy)]"
              >
                <SearchIcon />
              </Link>
              <Link
                href="/category/hot-clip"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[var(--bt-red)] hover:bg-[var(--bt-red-600)] !text-white text-xs font-bold transition-colors"
              >
                <VideoIcon />
                ดูวิดีโอ
              </Link>
            </div>

            {/* Social icons */}
            <div className="hidden lg:flex items-center gap-1">
              <a
                href="https://www.facebook.com/BrightTVOfficialMedia"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bt-bg)] text-[var(--bt-navy)] hover:bg-[#1877F2] hover:!text-white transition-colors"
              >
                <SocialIcon name="facebook" />
              </a>
              <a
                href="https://x.com/BrightTVth"
                target="_blank"
                rel="noreferrer"
                aria-label="X (Twitter)"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bt-bg)] text-[var(--bt-navy)] hover:bg-black hover:!text-white transition-colors"
              >
                <SocialIcon name="x" />
              </a>
              <a
                href="https://www.youtube.com/brighttv20"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bt-bg)] text-[var(--bt-navy)] hover:bg-[#FF0000] hover:!text-white transition-colors"
              >
                <SocialIcon name="youtube" />
              </a>
              <a
                href="https://www.instagram.com/brighttv"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bt-bg)] text-[var(--bt-navy)] hover:bg-gradient-to-br hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] hover:!text-white transition-colors"
              >
                <SocialIcon name="instagram" />
              </a>
              <a
                href="https://www.tiktok.com/@brighttv"
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--bt-bg)] text-[var(--bt-navy)] hover:bg-black hover:!text-white transition-colors"
              >
                <SocialIcon name="tiktok" />
              </a>
            </div>

            <Link
              href="/lotto"
              className="hidden md:inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-white hover:bg-[var(--bt-bg)] text-[var(--bt-navy)] text-sm font-bold border border-[var(--bt-line)] hover:border-[var(--bt-navy)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7h12M8 12h12M8 17h12"/><circle cx="4" cy="7" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="17" r="1.5"/></svg>
              ตรวจหวย
            </Link>
            <Link
              href="/category/hot-clip"
              className="hidden md:inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-[var(--bt-red)] hover:bg-[var(--bt-red-600)] !text-white text-sm font-bold transition-colors"
            >
              <VideoIcon />
              ดูวิดีโอ
            </Link>
          </div>
        </div>

        {/* Primary nav — desktop only (mobile uses hamburger) */}
        <nav className="hidden md:block border-t border-[var(--bt-line)] bg-white group-data-[scrolled=true]/header:border-transparent">
          <div className="mx-auto max-w-[1240px] px-2 sm:px-4 flex items-center gap-2">
            {/* Compact logo — only when scrolled */}
            <Link
              href="/"
              aria-label="Bright TV"
              className="shrink-0 hidden group-data-[scrolled=true]/header:flex items-center pr-2 mr-1 border-r border-[var(--bt-line)]"
            >
              <Image src="/logo.svg" alt="Bright TV" width={108} height={26} className="h-7 w-auto" />
            </Link>

            <ul className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
              <li className="group-data-[scrolled=true]/header:hidden">
                <Link
                  href="/"
                  aria-label="หน้าแรก"
                  className="flex items-center h-12 pr-3 text-[var(--bt-navy)] hover:text-[var(--bt-red)] transition-colors"
                >
                  <HomeIcon />
                </Link>
              </li>
              {PRIMARY_NAV.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="relative flex items-center h-12 px-3 sm:px-4 text-[14px] font-semibold text-[var(--bt-text)] hover:text-[var(--bt-red)] whitespace-nowrap transition-colors"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Date + Font size control — right of nav */}
            <div className="hidden lg:flex items-center gap-3 pl-3 ml-1 border-l border-[var(--bt-line)] shrink-0 group-data-[scrolled=true]/header:hidden">
              <span className="text-[12px] font-semibold text-[var(--bt-muted)] whitespace-nowrap">
                {today || "\u00A0"}
              </span>
              <FontSizeControl />
            </div>

            {/* Compact actions — only when scrolled */}
            <div className="hidden group-data-[scrolled=true]/header:flex items-center gap-2 pl-2 ml-1 border-l border-[var(--bt-line)] shrink-0">
              <Link
                href="/search"
                aria-label="ค้นหา"
                className="w-9 h-9 rounded-full bg-[var(--bt-bg)] hover:bg-[var(--bt-navy-50)] flex items-center justify-center text-[var(--bt-navy)]"
              >
                <SearchIcon />
              </Link>
              <Link
                href="/category/hot-clip"
                className="hidden sm:inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-[var(--bt-red)] hover:bg-[var(--bt-red-600)] !text-white text-xs font-bold transition-colors"
              >
                <VideoIcon />
                ดูวิดีโอ
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!menuOpen}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setMenuOpen(false)}
        />
        <aside
          className={`absolute top-0 left-0 h-full w-[84%] max-w-[340px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="bg-[var(--bt-navy)] px-5 py-4 flex items-center justify-between">
            <Image src="/logo-inverse.svg" alt="Bright TV" width={140} height={34} className="h-9 w-auto" />
            <button
              type="button"
              aria-label="ปิดเมนู"
              onClick={() => setMenuOpen(false)}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white"
            >
              <CloseIcon />
            </button>
          </div>

          <form action="/search" className="px-4 py-4 border-b border-[var(--bt-line)]">
            <div className="flex items-center bg-[var(--bt-bg)] rounded-full pl-4 pr-1 h-11 border border-[var(--bt-line)] focus-within:border-[var(--bt-navy)]">
              <SearchIcon />
              <input
                type="search"
                name="q"
                placeholder="ค้นหาข่าว..."
                className="bg-transparent outline-none flex-1 px-3 text-sm placeholder:text-[var(--bt-muted)]"
              />
              <button type="submit" className="h-9 px-4 rounded-full bg-[var(--bt-navy)] text-white text-xs font-bold">
                ค้นหา
              </button>
            </div>
          </form>

          <nav className="flex-1 overflow-y-auto px-2 py-2">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="flex items-center h-12 px-4 rounded-lg text-[15px] font-bold text-[var(--bt-navy)] hover:bg-[var(--bt-bg)]"
            >
              หน้าแรก
            </Link>
            {PRIMARY_NAV.map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center h-12 px-4 rounded-lg text-[15px] font-semibold text-[var(--bt-text)] hover:bg-[var(--bt-bg)] hover:text-[var(--bt-red)]"
              >
                <span className="inline-block w-1 h-4 rounded-sm bg-[var(--bt-red)] mr-3" />
                {c.name}
              </Link>
            ))}
          </nav>

          <div className="border-t border-[var(--bt-line)] px-5 py-4">
            <p className="text-xs text-[var(--bt-muted)] mb-2">ติดตามเรา</p>
            <div className="flex gap-2 flex-wrap">
              <a href="https://www.facebook.com/BrightTVOfficialMedia" target="_blank" rel="noreferrer" aria-label="Facebook" className="w-9 h-9 rounded-full bg-[var(--bt-bg)] hover:bg-[var(--bt-navy)] hover:!text-white flex items-center justify-center text-[var(--bt-navy)]">
                <SocialIcon name="facebook" />
              </a>
              <a href="https://x.com/BrightTVth" target="_blank" rel="noreferrer" aria-label="X (Twitter)" className="w-9 h-9 rounded-full bg-[var(--bt-bg)] hover:bg-[var(--bt-navy)] hover:!text-white flex items-center justify-center text-[var(--bt-navy)]">
                <SocialIcon name="x" />
              </a>
              <a href="https://www.youtube.com/brighttv20" target="_blank" rel="noreferrer" aria-label="YouTube" className="w-9 h-9 rounded-full bg-[var(--bt-bg)] hover:bg-[var(--bt-navy)] hover:!text-white flex items-center justify-center text-[var(--bt-navy)]">
                <SocialIcon name="youtube" />
              </a>
              <a href="https://www.instagram.com/brighttv" target="_blank" rel="noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-full bg-[var(--bt-bg)] hover:bg-[var(--bt-navy)] hover:!text-white flex items-center justify-center text-[var(--bt-navy)]">
                <SocialIcon name="instagram" />
              </a>
              <a href="https://www.tiktok.com/@brighttv" target="_blank" rel="noreferrer" aria-label="TikTok" className="w-9 h-9 rounded-full bg-[var(--bt-bg)] hover:bg-[var(--bt-navy)] hover:!text-white flex items-center justify-center text-[var(--bt-navy)]">
                <SocialIcon name="tiktok" />
              </a>
            </div>
            <p className="mt-3 text-[11px] text-[var(--bt-muted)]">{today}</p>
          </div>
        </aside>
      </div>
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--bt-muted)]">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 12 3l9 9" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
      <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
      <path d="m22 8-6 4 6 4V8z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

type SocialName = "facebook" | "x" | "youtube" | "instagram" | "tiktok";

function SocialIcon({ name }: { name: SocialName }) {
  const props = { width: 16, height: 16, fill: "currentColor" } as const;
  if (name === "facebook")
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.8c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5V12h2.6l-.4 2.9h-2.2v7A10 10 0 0 0 22 12" />
      </svg>
    );
  if (name === "x")
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M18.244 2H21l-6.522 7.45L22 22h-6.094l-4.77-6.231L5.7 22H3l7.013-8.01L2 2h6.245l4.31 5.696L18.244 2zm-1.07 18h1.687L7.01 4H5.198L17.174 20z" />
      </svg>
    );
  if (name === "youtube")
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19.1 4.6 12 4.6 12 4.6s-7.1 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.8.5 8.9.5 8.9.5s7.1 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.5.5-3.2.5-4.8s-.1-3.3-.5-4.8M9.8 15.4V8.6l5.9 3.4z" />
      </svg>
    );
  if (name === "instagram")
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2 0 1.8.3 2.3.4.6.2 1 .5 1.4 1 .5.4.8.9 1 1.4.2.5.4 1.1.4 2.3.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c0 1.2-.3 1.8-.4 2.3-.2.6-.5 1-1 1.4-.4.5-.9.8-1.4 1-.5.2-1.1.4-2.3.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2 0-1.8-.3-2.3-.4-.6-.2-1-.5-1.4-1-.5-.4-.8-.9-1-1.4-.2-.5-.4-1.1-.4-2.3-.1-1.2-.1-1.6-.1-4.8s0-3.6.1-4.8c0-1.2.3-1.8.4-2.3.2-.6.5-1 1-1.4.4-.5.9-.8 1.4-1 .5-.2 1.1-.4 2.3-.4 1.2-.1 1.6-.1 4.8-.1m0-2.2C8.7 0 8.3 0 7.1.1 5.9.1 5 .3 4.3.6c-.8.3-1.4.7-2.1 1.4C1.5 2.7 1.1 3.4.8 4.1.5 4.9.3 5.7.2 6.9.1 8.1.1 8.5.1 11.8s0 3.7.1 4.9c.1 1.2.3 2 .6 2.8.3.8.7 1.4 1.4 2.1.7.7 1.3 1.1 2.1 1.4.8.3 1.6.5 2.8.6 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c1.2-.1 2-.3 2.8-.6.8-.3 1.4-.7 2.1-1.4.7-.7 1.1-1.3 1.4-2.1.3-.8.5-1.6.6-2.8.1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.2-.3-2-.6-2.8-.3-.8-.7-1.4-1.4-2.1C21.3 1.5 20.6 1.1 19.9.8c-.8-.3-1.6-.5-2.8-.6C15.9 0 15.5 0 12 0zm0 5.8A6.2 6.2 0 1 0 12 18.2 6.2 6.2 0 0 0 12 5.8zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.8-10.4a1.4 1.4 0 1 1-2.9 0 1.4 1.4 0 0 1 2.9 0z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M16.5 2h-3v13.4a3.1 3.1 0 1 1-2.2-3v-3a6.1 6.1 0 1 0 5.2 6V9.4a8 8 0 0 0 4.6 1.4V7.8a4.7 4.7 0 0 1-4.6-5.8" />
    </svg>
  );
}
