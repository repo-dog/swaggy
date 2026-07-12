import type { Operation } from "@swaggy/shared";
import type { RequestInputs } from "./buildProxyRequest.js";

// Seed the request body with ONLY the values the spec actually declares (example/default).
// We deliberately do NOT fabricate placeholder samples ("", 0, false, []) for untouched
// fields: doing so pre-filled optional fields with invalid values (e.g. "" for an enum),
// which tripped live validation ("must be one of …" / range errors) before the user typed
// anything. Fields without a declared value are omitted; rjsf still renders every field
// from the schema, and required fields correctly report as missing.
export function sampleFromSchema(schema: any): unknown {
  if (!schema || typeof schema !== "object") return undefined;
  if ("example" in schema) return schema.example;
  if ("default" in schema) return schema.default;
  if (schema.type === "object" && schema.properties) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries<any>(schema.properties)) {
      const seeded = sampleFromSchema(v);
      if (seeded !== undefined) out[k] = seeded;
    }
    // Omit an object with nothing seeded rather than emit `{}` — an empty optional object
    // would otherwise fail its own required-children validation on an untouched field.
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return undefined;
}

// A full skeleton of a body schema with EVERY field present (required and optional), used
// as an editable template in the advanced raw-JSON editor so the user can see and fill
// optional fields. Unlike sampleFromSchema this deliberately fabricates placeholders — it's
// display-only for the raw editor, not what gets sent until the user edits it.
export function skeletonFromSchema(schema: any, depth = 0): unknown {
  if (!schema || typeof schema !== "object") return null;
  if ("example" in schema) return schema.example;
  if ("default" in schema) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.type === "object" || schema.properties) {
    // Bound object recursion too (not just arrays) so a recursive/self-referential schema
    // can't blow the stack while building the template.
    if (depth >= 6) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries<any>(schema.properties ?? {})) out[k] = skeletonFromSchema(v, depth + 1);
    return out;
  }
  // Show one representative item so the array's shape is visible (bounded to avoid deep nesting).
  if (schema.type === "array") return depth < 4 && schema.items ? [skeletonFromSchema(schema.items, depth + 1)] : [];
  if (schema.type === "integer" || schema.type === "number") return 0;
  if (schema.type === "boolean") return false;
  return ""; // string / unknown
}

function scalarDefault(param: any): string | undefined {
  // Check param-level default/example first, then schema-level
  if (param && "default" in param) return String(param.default);
  if (param && "example" in param) return String(param.example);
  if (param?.schema && "default" in param.schema) return String(param.schema.default);
  if (param?.schema && "example" in param.schema) return String(param.schema.example);
  return undefined;
}

export function initialInputsFor(op: Operation): RequestInputs {
  const pathParams: Record<string, string> = {};
  for (const p of op.pathParams) { const d = scalarDefault(p); if (d !== undefined) pathParams[p.name] = d; }
  const query: Record<string, string | string[]> = {};
  for (const p of op.queryParams) { const d = scalarDefault(p); if (d !== undefined) query[p.name] = d; }
  const headers: Record<string, string> = {};
  for (const p of op.headerParams) { const d = scalarDefault(p); if (d !== undefined) headers[p.name] = d; }
  return {
    server: op.servers[0] ?? "",
    pathParams,
    query,
    headers,
    body: op.requestBody ? sampleFromSchema(op.requestBody.jsonSchema) : undefined,
  };
}
