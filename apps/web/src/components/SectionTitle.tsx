import Link from "next/link";

export default function SectionTitle({
  title,
  href,
}: {
  title: string;
  href?: string;
  /** @deprecated kept for backwards compatibility — bar is always red */
  accent?: "navy" | "red";
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5 border-b-2 border-[var(--bt-line)] pb-2">
      <h2 className="relative text-xl sm:text-2xl font-extrabold text-[var(--bt-navy)] flex items-center">
        <span className="inline-block w-1.5 h-6 rounded-sm mr-3 bg-[var(--bt-red)]" />
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="text-xs sm:text-sm font-semibold text-[var(--bt-muted)] hover:text-[var(--bt-red)] transition-colors"
        >
          ดูทั้งหมด ›
        </Link>
      )}
    </div>
  );
}
