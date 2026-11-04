"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Sticky sidebar that scrolls naturally until its own bottom reaches the
// viewport bottom, then pins there — so a tall sidebar (taller than the
// viewport) is fully readable before it locks. Achieves this by setting
// `top: calc(100vh - content_height - bottomGap)` as an inline style on the
// actual rendered <aside>, recomputing whenever the element resizes.
export default function StickyBottomAside({
  children,
  className = "",
  bottomGap = 24,
}: {
  children: ReactNode;
  className?: string;
  bottomGap?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      // Only apply on large viewports where the aside is actually sticky.
      // On mobile the aside stacks and needs no sticky math.
      el.style.setProperty("--aside-h", `${el.offsetHeight}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <aside
      ref={ref}
      className={`lg:sticky lg:self-start ${className}`}
      style={{
        top: `calc(100vh - var(--aside-h, 1000px) - ${bottomGap}px)`,
      }}
    >
      {children}
    </aside>
  );
}
