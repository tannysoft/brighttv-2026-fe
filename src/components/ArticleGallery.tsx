"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { timeAgoTH } from "@/lib/utils";

type GalleryImage = {
  id: number;
  alt: string;
  sizes: Partial<
    Record<string, { ID?: number; width: number; height: number; src: string }>
  >;
};

type NormalizedImage = {
  id: number;
  alt: string;
  thumbSrc: string;
  fullSrc: string;
  fullWidth: number;
  fullHeight: number;
  orientation: "portrait" | "landscape";
};

export type RelatedPostItem = {
  id: number;
  title: string;
  href: string;
  thumbSrc: string;
  /** ISO date string — passed to timeAgoTH for the meta row. Optional so
   *  callers that don't have one can omit it safely. */
  date?: string;
};

type Props = {
  images: GalleryImage[];
  articleTitle: string;
  articleUrl: string;
  relatedPosts?: RelatedPostItem[];
};

// Thumbnail grid + full-screen lightbox. Lightbox uses a Bright-style layout:
// left side is the image area with prev/next nav, right side is a white
// sidebar with gallery count, share buttons, article title, and a list of
// related gallery albums. Keyboard (Esc/←/→), scroll lock, and click-away
// dismiss are wired up.
export default function ArticleGallery({
  images,
  articleTitle,
  articleUrl,
  relatedPosts = [],
}: Props) {
  const normalized = normalize(images);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i + 1) % normalized.length)),
    [normalized.length],
  );
  const prev = useCallback(
    () =>
      setOpenIndex((i) =>
        i === null ? null : (i - 1 + normalized.length) % normalized.length,
      ),
    [normalized.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, close, next, prev]);

  if (!normalized.length) return null;

  const current = openIndex !== null ? normalized[openIndex] : null;

  return (
    <section className="mt-10 pt-8 border-t border-[var(--bt-line)]">
      <h2 className="text-lg sm:text-xl font-extrabold text-[var(--bt-navy)] mb-4 flex items-center gap-2">
        <span className="inline-block w-1.5 h-5 rounded-sm bg-[var(--bt-red)]" />
        ภาพประกอบ
        <span className="ml-1 text-xs font-semibold text-[var(--bt-muted)]">
          ({normalized.length})
        </span>
      </h2>

      {/* Masonry columns with two canonical aspect ratios: every landscape
          thumbnail is forced to 16:9 and every portrait thumbnail to 3:4.
          That gives a uniform, rhythmic grid while still respecting each
          image's orientation so portrait photos aren't squished into a
          widescreen crop. Slight center-crop on outliers is acceptable. */}
      <div className="columns-2 sm:columns-3 gap-2 sm:gap-3 [column-fill:_balance]">
        {normalized.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className={`group relative block w-full overflow-hidden rounded-lg bg-[var(--bt-navy-50)] mb-2 sm:mb-3 break-inside-avoid focus:outline-none focus:ring-2 focus:ring-[var(--bt-red)] focus:ring-offset-2 ${
              img.orientation === "portrait" ? "aspect-[3/4]" : "aspect-[16/9]"
            }`}
            aria-label={`ดูภาพที่ ${i + 1}${img.alt ? ` — ${img.alt}` : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.thumbSrc}
              alt={img.alt}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <span className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 h-6 px-2 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIcon />
              ขยาย
            </span>
          </button>
        ))}
      </div>

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`รูปที่ ${openIndex! + 1} จาก ${normalized.length}`}
          className="fixed inset-0 z-[100] flex"
          onClick={close}
        >
          {/* ===== Image area ===== */}
          <div className="relative flex-1 bg-[#1f1f22] flex items-center justify-center min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.fullSrc}
              alt={current.alt}
              width={current.fullWidth}
              height={current.fullHeight}
              className="max-h-[92vh] max-w-[92%] object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {normalized.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  aria-label="รูปก่อนหน้า"
                  className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                >
                  <ArrowIcon direction="left" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  aria-label="รูปถัดไป"
                  className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                >
                  <ArrowIcon direction="right" />
                </button>
              </>
            )}

            {/* Mobile-only close: on desktop the close lives in the sidebar
                header, but on mobile the sidebar is hidden so we need it here */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
              aria-label="ปิด"
              className="lg:hidden absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              <CloseIcon />
            </button>

            {/* Mobile counter */}
            <div className="lg:hidden absolute bottom-4 left-0 right-0 text-center">
              <span className="text-[11px] font-bold text-white/70 tabular-nums">
                {openIndex! + 1} / {normalized.length}
              </span>
            </div>
          </div>

          {/* ===== Sidebar ===== */}
          <aside
            className="hidden lg:flex w-[360px] xl:w-[400px] shrink-0 flex-col bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: count + close */}
            <div className="flex items-center justify-between px-5 h-[60px] border-b border-[var(--bt-line)]">
              <div className="flex items-center gap-2 text-[var(--bt-navy)]">
                <GalleryIcon />
                <span className="text-sm font-bold tabular-nums">
                  {normalized.length} ภาพ
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="ปิด"
                className="w-9 h-9 -mr-2 rounded-full hover:bg-[var(--bt-bg)] text-[var(--bt-navy)] flex items-center justify-center transition-colors"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Body: scroll area */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Share */}
              <ShareRow title={articleTitle} url={articleUrl} />

              {/* Article title */}
              <h3 className="text-[15px] font-extrabold leading-snug text-[var(--bt-navy)] clamp-3">
                {articleTitle}
              </h3>

              {/* Related posts */}
              {relatedPosts.length > 0 && (
                <div className="pt-4 border-t border-[var(--bt-line)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-[var(--bt-navy)]">
                      <span className="inline-block w-1 h-4 rounded-sm bg-[var(--bt-red)]" />
                      <span className="text-[13px] font-bold">
                        ข่าวที่เกี่ยวข้อง
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {relatedPosts.slice(0, 6).map((r) => (
                      <li key={r.id}>
                        <Link
                          href={r.href}
                          className="group flex gap-3 items-start"
                          onClick={close}
                        >
                          <div className="relative w-[92px] aspect-[16/9] shrink-0 overflow-hidden rounded-md bg-[var(--bt-navy-50)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={r.thumbSrc}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[12px] font-bold leading-snug text-[var(--bt-text)] clamp-2 group-hover:text-[var(--bt-red)] transition-colors">
                              {r.title}
                            </h4>
                            {r.date && (
                              <p className="mt-1 text-[10px] text-[var(--bt-muted)] leading-none">
                                {timeAgoTH(r.date)}
                              </p>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

// ---------- sidebar bits ----------

function ShareRow({ title, url }: { title: string; url: string }) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const x = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
  const line = `https://line.me/R/msg/text/?${encodedTitle}%20${encodedUrl}`;

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Fallback for older browsers / denied permission: legacy exec
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
      } catch {
        // give up silently
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <ShareBtn href={fb} label="Facebook" bg="#1877F2">
        <FbIcon />
      </ShareBtn>
      <ShareBtn href={x} label="X (Twitter)" bg="#000">
        <XIcon />
      </ShareBtn>
      <ShareBtn href={line} label="LINE" bg="#06C755">
        <LineIcon />
      </ShareBtn>
      <div className="relative inline-flex">
        <button
          type="button"
          onClick={copyLink}
          aria-label={copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}
          title={copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
          className="relative inline-flex items-center justify-center w-10 h-10 rounded-full !text-white hover:scale-110 transition-colors"
          style={{ background: copied ? "#16a34a" : "#e4262b" }}
        >
          <span
            className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
              copied ? "opacity-0 scale-75 rotate-[-20deg]" : "opacity-100 scale-100 rotate-0"
            }`}
          >
            <LinkIcon />
          </span>
          <span
            className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
              copied ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-75 rotate-[20deg]"
            }`}
          >
            <CheckIcon />
          </span>
        </button>

        {/* Floating toast to the RIGHT of the button. Equal padding all
            around the label; the overlapping diamond handles the arrow so
            we don't need asymmetric padding to make room for it. */}
        <span
          aria-live="polite"
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 left-[calc(100%+14px)] z-20 whitespace-nowrap rounded-full bg-[var(--bt-navy)] !text-white text-[11px] font-bold px-3 py-1 shadow-lg transition-all duration-200 ${
            copied ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
          }`}
        >
          {/* Diamond pushed 4px into the pill body so its vertical tips land
              well inside the rounded-full curve (no visible gap where the
              arrow meets the body). The left point still pokes out far
              enough to read as a leftward arrow. */}
          <span
            aria-hidden
            className="absolute top-1/2 left-1 -translate-x-1/2 -translate-y-1/2 rotate-45 w-3 h-3 bg-[var(--bt-navy)]"
          />
          <span className="relative">คัดลอกแล้ว</span>
        </span>
      </div>
    </div>
  );
}

function ShareBtn({
  href,
  label,
  bg,
  children,
}: {
  href: string;
  label: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`แชร์ไปที่ ${label}`}
      title={`แชร์ไปที่ ${label}`}
      className="inline-flex items-center justify-center w-10 h-10 rounded-full !text-white hover:scale-110 transition-transform"
      style={{ background: bg }}
    >
      {children}
    </a>
  );
}

// ---------- normalization ----------

function normalize(images: GalleryImage[]): NormalizedImage[] {
  return images
    .map((img) => {
      const s = img.sizes ?? {};
      // Thumbnail: grid cards render ~250-320px wide; on 2× retina that
      // means we need ~500-640px source to stay crisp. Prefer large, then
      // medium_large, before falling back to the small sizes.
      const thumb =
        s.large ?? s.medium_large ?? s.full ?? s.medium ?? s.thumbnail;
      const full =
        s.full ?? s["2048x2048"] ?? s["1536x1536"] ?? s.large ?? s.medium_large ?? s.medium;
      if (!thumb || !full) return null;
      return {
        id: img.id,
        alt: img.alt || "",
        thumbSrc: thumb.src,
        fullSrc: full.src,
        fullWidth: full.width,
        fullHeight: full.height,
        orientation: full.height > full.width ? "portrait" : "landscape",
      } satisfies NormalizedImage;
    })
    .filter((x): x is NormalizedImage => x !== null);
}

// ---------- icons ----------

function ZoomIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={direction === "left" ? "" : "rotate-180"} aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function FbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H8v-2.9h2.4V9.8c0-2.4 1.4-3.7 3.6-3.7 1 0 2.1.2 2.1.2v2.3h-1.2c-1.2 0-1.5.7-1.5 1.5V12h2.6l-.4 2.9h-2.2v7A10 10 0 0 0 22 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2H21l-6.522 7.45L22 22h-6.094l-4.77-6.231L5.7 22H3l7.013-8.01L2 2h6.245l4.31 5.696L18.244 2zm-1.07 18h1.687L7.01 4H5.198L17.174 20z" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016a.63.63 0 0 1-.451.605.6.6 0 0 1-.182.027.63.63 0 0 1-.512-.257l-2.443-3.323v2.95a.63.63 0 0 1-.629.628.628.628 0 0 1-.626-.628V8.108a.63.63 0 0 1 .43-.598c.06-.022.137-.034.196-.034.197 0 .378.105.494.255l2.458 3.336v-2.96c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.772zm-5.741 0a.629.629 0 0 1-.626.628.626.626 0 0 1-.626-.628V8.108c0-.345.282-.63.63-.63.345 0 .622.285.622.63v4.771zm-2.466.628H4.917a.625.625 0 0 1-.625-.628V8.108c0-.345.282-.63.628-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.628-.629.628M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
