export type HighlightPart = { text: string; match: boolean };

/**
 * Split `text` into segments, marking case-insensitive occurrences of `query`
 * as matches. Empty query returns the whole string as a single non-match.
 * Used to highlight the searched substring in palette results.
 */
export function splitHighlight(text: string, query: string): HighlightPart[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];

  const parts: HighlightPart[] = [];
  const lower = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(lowerQ, i);
    if (idx === -1) {
      parts.push({ text: text.slice(i), match: false });
      break;
    }
    if (idx > i) parts.push({ text: text.slice(i, idx), match: false });
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    i = idx + q.length;
  }
  return parts;
}
