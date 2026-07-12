import type { Operation } from "@swaggy/shared";

export type OperationGroup = { tag: string; ops: Operation[] };

export const DEFAULT_TAG = "default";

/**
 * Group operations by tag, Swagger-style: an operation appears under each of
 * its tags; untagged operations fall into the `default` group. Tags are sorted
 * alphabetically with `default` last. Operation order within a group is
 * preserved from the input.
 */
export function groupOperations(ops: Operation[]): OperationGroup[] {
  const buckets = new Map<string, Operation[]>();
  for (const op of ops) {
    const tags = op.tags.length > 0 ? op.tags : [DEFAULT_TAG];
    for (const tag of tags) {
      const arr = buckets.get(tag) ?? [];
      arr.push(op);
      buckets.set(tag, arr);
    }
  }
  const tags = [...buckets.keys()].sort((a, b) => {
    if (a === DEFAULT_TAG) return 1;
    if (b === DEFAULT_TAG) return -1;
    return a.localeCompare(b);
  });
  return tags.map((tag) => ({ tag, ops: buckets.get(tag)! }));
}
