/** Stable-sort `items` so those whose key appears in `order` come first (in that order);
 * items whose key is absent keep their original relative order at the end. */
export function applyOrder<T>(items: T[], keyOf: (item: T) => string, order: string[]): T[] {
  const rank = new Map(order.map((k, i) => [k, i]));
  return items
    .map((item, i) => ({ item, i, r: rank.has(keyOf(item)) ? rank.get(keyOf(item))! : Infinity }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item);
}

/** Move `dragId` so it sits immediately before `dropId`, preserving every other id.
 * Returns the input unchanged if either id is absent or they're the same. */
export function reorderById(ids: string[], dragId: string, dropId: string): string[] {
  if (dragId === dropId) return ids;
  if (!ids.includes(dragId) || !ids.includes(dropId)) return ids;
  const next = ids.filter((id) => id !== dragId);
  const insertAt = next.indexOf(dropId);
  next.splice(insertAt, 0, dragId);
  return next;
}
