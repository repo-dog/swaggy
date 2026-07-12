/** Sort operations by how often they've been selected (desc), keeping the original
 * relative order for equal counts (stable). Does not mutate the input. */
export function sortByFrequency<T extends { id: string }>(
  ops: T[],
  counts: Record<string, number>,
): T[] {
  return ops
    .map((op, i) => ({ op, i, count: counts[op.id] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .map((x) => x.op);
}
