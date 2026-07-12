import type { Operation } from "@swaggy/shared";

export function reconcileBookmarks(
  operationIds: string[],
  ops: Operation[],
): { available: Operation[]; missingIds: string[] } {
  const byId = new Map(ops.map((o) => [o.id, o]));
  const available: Operation[] = [];
  const missingIds: string[] = [];
  for (const id of operationIds) {
    const op = byId.get(id);
    if (op) available.push(op);
    else missingIds.push(id);
  }
  return { available, missingIds };
}
