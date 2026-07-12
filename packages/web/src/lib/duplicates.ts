/** Duplicate-name detection shared by the header / variable / snapshot editors. */

const normalize = (s: string, caseInsensitive: boolean) => {
  const t = s.trim();
  return caseInsensitive ? t.toLowerCase() : t;
};

/**
 * The normalized keys that appear more than once in `names` (empty/whitespace names
 * are ignored). Use to flag which rows in a list collide.
 */
export function duplicateNameKeys(names: string[], opts: { caseInsensitive?: boolean } = {}): Set<string> {
  const ci = opts.caseInsensitive ?? false;
  const counts = new Map<string, number>();
  for (const name of names) {
    const key = normalize(name, ci);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

/** Whether `name` collides with any entry in `existing` (trimmed; an empty name never collides). */
export function isDuplicateName(name: string, existing: string[], opts: { caseInsensitive?: boolean } = {}): boolean {
  const ci = opts.caseInsensitive ?? false;
  const key = normalize(name, ci);
  if (!key) return false;
  return existing.some((e) => normalize(e, ci) === key);
}
