import type { Operation } from "@swaggy/shared";
import type { Snapshot } from "../../store/store.types.js";

/**
 * Compare a saved snapshot against the operation as it exists now and report any
 * ways the API has drifted so the snapshot no longer cleanly applies. Returns an
 * empty array when the snapshot is still fully valid. The caller still applies the
 * snapshot's values best-effort and surfaces these messages to the user.
 */
export function snapshotDrift(op: Operation, snap: Snapshot): string[] {
  const issues: string[] = [];
  const inp = snap.inputs;

  // Server no longer offered by this operation.
  if (inp.server && op.servers.length > 0 && !op.servers.includes(inp.server)) {
    issues.push(`Server "${inp.server}" is no longer available for this operation.`);
  }

  // Path parameters are structural (part of the URL template); any mismatch is a real change.
  const pathNames = new Set(op.pathParams.map((p) => p.name));
  for (const key of Object.keys(inp.pathParams ?? {})) {
    if (!pathNames.has(key)) issues.push(`Path parameter "${key}" no longer exists on this operation.`);
  }
  for (const p of op.pathParams) {
    if (p.required && !inp.pathParams?.[p.name]) {
      issues.push(`Required path parameter "${p.name}" is missing from this snapshot.`);
    }
  }

  // Newly-required query / header params the snapshot can't satisfy.
  for (const p of op.queryParams) {
    const v = inp.query?.[p.name];
    if (p.required && (v === undefined || v === "")) {
      issues.push(`Required query parameter "${p.name}" is missing from this snapshot.`);
    }
  }
  for (const p of op.headerParams) {
    const v = inp.headers?.[p.name];
    if (p.required && (v === undefined || v === "")) {
      issues.push(`Required header "${p.name}" is missing from this snapshot.`);
    }
  }

  // Request body presence changed.
  const hasBody =
    inp.body !== undefined && inp.body !== null && !(typeof inp.body === "string" && inp.body.trim() === "");
  if (!op.requestBody && hasBody) {
    issues.push("This operation no longer accepts a request body, but the snapshot includes one.");
  } else if (op.requestBody && !hasBody) {
    issues.push("This operation now expects a request body, which this snapshot doesn't include.");
  }

  return issues;
}
