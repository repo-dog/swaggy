import type { Operation, ProxyRequest } from "@swaggy/shared";
import type { CommonHeader, RequestInputs } from "../../store/store.types.js";
import { interpolateString, interpolateDeep } from "./templating.js";

// RequestInputs is defined in the store types (it is persisted there); re-exported
// here so the many request-feature modules that import it need no changes.
export type { RequestInputs };

export function buildProxyRequest(
  op: Operation,
  inputs: RequestInputs,
  commonHeaders: CommonHeader[],
  variables: Record<string, string> = {},
  auth: { headers?: Record<string, string>; query?: Record<string, string> } = {},
): ProxyRequest {
  // Common (profile) headers are applied ONLY to requests whose spec declares a header
  // parameter of the same name — they aren't blasted onto every request. Request-level
  // header inputs (the spec's header fields) still win over the common value.
  const declaredHeaders = new Set(op.headerParams.map((p) => p.name.toLowerCase()));
  const headers: Record<string, string> = {};
  for (const h of commonHeaders) {
    // Skip disabled headers so they can be toggled off temporarily without being deleted.
    if (h.enabled === false) continue;
    if (h.name.trim() && h.value.trim() && declaredHeaders.has(h.name.toLowerCase())) headers[h.name] = h.value;
  }
  // Auth headers (Authorization, X-API-Key, …) come from the profile's security credentials
  // and are applied unconditionally (they're not declared header params). Explicit request
  // headers still win.
  Object.assign(headers, auth.headers ?? {});
  // Ad-hoc headers the user added (any name), applied before the declared header inputs so an
  // explicit spec header field still wins on a name collision. Empty-name rows are skipped.
  for (const h of inputs.customHeaders ?? []) {
    if (h.name.trim()) headers[h.name] = h.value;
  }
  Object.assign(headers, inputs.headers); // explicit request headers win

  // Drop empty entries from multi-value (array) query params, and omit a query key
  // whose array is entirely empty, so trailing edit rows don't reach the wire. Auth query
  // params (e.g. an apiKey in query) seed the map first; explicit request query wins.
  const query: Record<string, string | string[]> = { ...(auth.query ?? {}) };
  for (const [k, v] of Object.entries(inputs.query)) {
    if (Array.isArray(v)) {
      const cleaned = v.filter((x) => x !== "");
      if (cleaned.length > 0) query[k] = cleaned;
    } else {
      query[k] = v;
    }
  }

  // Resolve {{name}} references against the active profile's variables across every
  // field, so a value captured from one response can feed the next request.
  const resolvedHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) resolvedHeaders[k] = interpolateString(v, variables);

  return {
    operationId: op.id,
    server: interpolateString(inputs.server, variables),
    method: op.method,
    path: op.path,
    pathParams: interpolateDeep(inputs.pathParams, variables),
    query: interpolateDeep(query, variables),
    headers: resolvedHeaders,
    body: interpolateDeep(inputs.body, variables),
  };
}
