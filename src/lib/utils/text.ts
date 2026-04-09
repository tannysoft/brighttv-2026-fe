// Strip HTML tags and decode the most common numeric/named character
// references that WordPress emits in rendered fields. Safe for trimming
// titles, excerpts, and alt attributes.
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#[0-9]+;/g, "")
    .trim();
}
