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
