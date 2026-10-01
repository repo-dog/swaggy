import { useMemo } from "react";
import Fuse from "fuse.js";
import type { Operation } from "@swaggy/shared";

const KEYS = ["method", "path", "summary", "tags", "specTitle"];

export function searchOperations(ops: Operation[], query: string): Operation[] {
  if (!query.trim()) return ops;
  const fuse = new Fuse(ops, { keys: KEYS, threshold: 0.4, ignoreLocation: true });
  return fuse.search(query).map((r) => r.item);
}

export function useSearch(ops: Operation[], query: string): Operation[] {
  const fuse = useMemo(() => new Fuse(ops, { keys: KEYS, threshold: 0.4, ignoreLocation: true }), [ops]);
  return useMemo(() => (query.trim() ? fuse.search(query).map((r) => r.item) : ops), [fuse, ops, query]);
}

/**
 * IDs of operations that fuzzily match `query` on path/summary/description. Tighter than the
 * palette search (used to widen the sidebar's substring filter without drowning it in noise).
 */
export function fuzzyMatchIds(ops: Operation[], query: string): Set<string> {
  if (!query.trim()) return new Set();
  const fuse = new Fuse(ops, { keys: ["path", "summary", "description"], threshold: 0.35, ignoreLocation: true });
  return new Set(fuse.search(query.trim()).map((r) => r.item.id));
}
