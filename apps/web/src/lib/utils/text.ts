// Named character references WordPress (wptexturize, esc_html) and editors
// commonly emit in titles/excerpts. Numeric references (&#8211; &#x2013;)
// are handled generically in decodeEntities().
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  laquo: "«",
  raquo: "»",
  lsaquo: "‹",
  rsaquo: "›",
  bull: "•",
  middot: "·",
  prime: "′",
  Prime: "″",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  times: "×",
  divide: "÷",
  plusmn: "±",
  minus: "−",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  sect: "§",
  para: "¶",
  dagger: "†",
  Dagger: "‡",
  permil: "‰",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  thinsp: " ",
  ensp: " ",
  emsp: " ",
  zwj: "‍",
  zwnj: "‌",
  shy: "­",
};

/**
 * Decode HTML character references (decimal, hex and common named ones) to
 * plain text. The result is TEXT: render it through React (which escapes
 * it) or escape it again before putting it into HTML/XML.
 */
export function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, ref: string) => {
    if (ref[0] === "#") {
      const code =
        ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      // Invalid / surrogate / NUL code points stay as they were.
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return m;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[ref] ?? m;
  });
}

// Strip HTML tags and decode character references that WordPress emits in
// rendered fields. Returns plain text (React escapes it on render) — safe
// for titles, excerpts and alt attributes.
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  // Tags are removed BEFORE decoding so an encoded "&lt;b&gt;" stays as the
  // literal text "<b>" instead of being treated as markup.
  return decodeEntities(html.replace(/<[^>]*>/g, "")).trim();
}

/**
 * Meta description from rendered HTML or plain text: tags stripped, entities
 * decoded, whitespace collapsed, then cut to `max` chars at the last space
 * (Thai often has none — then a hard cut) with "…" appended when cut.
 */
export function metaDescription(input: string | null | undefined, max = 155): string {
  const text = stripHtml(input)
    .replace(/\s+/g, " ")
    // WordPress auto-excerpt marker "[…]" → a plain ellipsis.
    .replace(/\s*\[(?:…|\.\.\.)\]\s*$/, "…")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  // Only back up to a space if it doesn't throw away most of the text.
  const head = space >= max * 0.6 ? cut.slice(0, space) : cut;
  return `${head.replace(/[\s,.;:–—-]+$/, "")}…`;
}
