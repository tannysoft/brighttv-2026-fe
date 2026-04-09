import Link from "next/link";
import { getTopTags } from "@/lib/wp";
import SectionTitle from "./SectionTitle";

// "แท็กยอดนิยม" pill cloud rendered at the bottom of the article page
// sidebar. Data comes from `/wp-json/nuxt/v1/top-tags` (Bright's custom
// endpoint that ranks tags by post count across a recent scan window).
export default async function TopKeywordsWidget() {
  const tags = await getTopTags();
  if (!tags.length) return null;

  return (
    <section>
      <SectionTitle title="แท็กยอดนิยม" accent="red" />
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Link
            key={t.term_id}
            href={`/tag/${t.slug}`}
            title={`${t.name} · ${t.count} ข่าว`}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-[var(--bt-bg)] border border-[var(--bt-line)] text-[12px] font-semibold text-[var(--bt-navy)] hover:bg-[var(--bt-navy)] hover:!text-white hover:border-[var(--bt-navy)] transition-colors"
          >
            <span className="text-[var(--bt-red)]">#</span>
            {t.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
