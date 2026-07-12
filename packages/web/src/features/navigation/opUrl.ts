/** Shareable-URL helpers: the selected operation id lives in the `op` query param. */

/** Read the selected operation id from a URL query string (e.g. "?op=users%3AgetUser"). */
export function readOpFromSearch(search: string): string | null {
  return new URLSearchParams(search).get("op") || null;
}

/** Return a new query string (with leading "?") that carries `op`, or "" when op is null. */
export function writeOpToSearch(search: string, op: string | null): string {
  const params = new URLSearchParams(search);
  if (op) params.set("op", op);
  else params.delete("op");
  const s = params.toString();
  return s ? `?${s}` : "";
}
