"use client";

import { useEffect, useState } from "react";

type Size = "sm" | "md";
type TooltipSide = "right" | "top" | "bottom" | "left";

type Props = {
  url: string;
  size?: Size;
  tooltipSide?: TooltipSide;
  label?: string;
};

const SIZE_MAP: Record<Size, { box: string; icon: number; textPad: string }> = {
  sm: { box: "w-9 h-9", icon: 14, textPad: "px-3 py-1" },
  md: { box: "w-10 h-10", icon: 16, textPad: "px-3.5 py-1.5" },
};

// Reusable "copy page link" button with a short-lived tooltip that confirms
// the clipboard action. Used in both the article page's share row and the
// gallery modal sidebar.
export default function CopyLinkButton({
  url,
  size = "sm",
  tooltipSide = "right",
  label = "คัดลอกลิงก์",
}: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Fallback for older browsers / denied clipboard permission.
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

  const { box, icon, textPad } = SIZE_MAP[size];

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? `${label}แล้ว` : label}
        title={copied ? "คัดลอกแล้ว" : label}
        className={`relative inline-flex items-center justify-center ${box} rounded-full !text-white hover:scale-110 transition-colors shadow-sm`}
        style={{ background: copied ? "#16a34a" : "#e4262b" }}
      >
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            copied
              ? "opacity-0 scale-75 rotate-[-20deg]"
              : "opacity-100 scale-100 rotate-0"
          }`}
        >
          <LinkIcon size={icon} />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            copied
              ? "opacity-100 scale-100 rotate-0"
              : "opacity-0 scale-75 rotate-[20deg]"
          }`}
        >
          <CheckIcon size={icon + 2} />
        </span>
      </button>

      <Tooltip visible={copied} side={tooltipSide} text={textPad}>
        คัดลอกแล้ว
      </Tooltip>
    </div>
  );
}

// ----- tooltip -----

function Tooltip({
  children,
  visible,
  side,
  text,
}: {
  children: React.ReactNode;
  visible: boolean;
  side: TooltipSide;
  text: string;
}) {
  // Position classes per side: pill position, entry-animation axis, and
  // diamond arrow anchor. A rotated square overlaps the pill body so no seam
  // shows where the arrow meets the rounded-full edge.
  const pillPos =
    side === "right"
      ? "top-1/2 -translate-y-1/2 left-[calc(100%+10px)]"
      : side === "left"
        ? "top-1/2 -translate-y-1/2 right-[calc(100%+10px)]"
        : side === "top"
          ? "left-1/2 -translate-x-1/2 bottom-[calc(100%+10px)]"
          : "left-1/2 -translate-x-1/2 top-[calc(100%+10px)]";

  const enter =
    side === "right"
      ? visible
        ? "opacity-100 translate-x-0"
        : "opacity-0 -translate-x-1"
      : side === "left"
        ? visible
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-1"
        : side === "top"
          ? visible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-1"
          : visible
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-1";

  // Arrow position is pushed 4px INTO the pill body from the facing edge so
  // the diamond's perpendicular tips land well inside the rounded-full curve
  // and no visible gap appears where the arrow meets the body.
  const arrowPos =
    side === "right"
      ? "top-1/2 left-1 -translate-x-1/2 -translate-y-1/2"
      : side === "left"
        ? "top-1/2 right-1 translate-x-1/2 -translate-y-1/2"
        : side === "top"
          ? "left-1/2 bottom-1 -translate-x-1/2 translate-y-1/2"
          : "left-1/2 top-1 -translate-x-1/2 -translate-y-1/2";

  return (
    <span
      aria-live="polite"
      className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-full bg-[var(--bt-navy)] !text-white text-[11px] font-bold ${text} shadow-lg transition-all duration-200 ${pillPos} ${enter}`}
    >
      <span
        aria-hidden
        className={`absolute rotate-45 w-3 h-3 bg-[var(--bt-navy)] ${arrowPos}`}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

// ----- icons -----

function LinkIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
