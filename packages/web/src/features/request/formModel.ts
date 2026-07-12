import type { Operation } from "@swaggy/shared";
import type { MultipartSendPart } from "../../lib/api.js";
import { interpolateString } from "./templating.js";

export type FormPartKind = "text" | "file";

/** One editable row of a form request body (multipart/form-data or x-www-form-urlencoded).
 * `fromSchema` rows are seeded from the spec (name fixed); ad-hoc rows are user-added. */
export type FormPart = {
  id: string;
  name: string;
  kind: FormPartKind;
  value: string;
  files: File[];
  enabled: boolean;
  fromSchema: boolean;
  required: boolean;
  schema?: Record<string, unknown>;
};

let counter = 0;
const nextId = () => `fp_${counter++}`;

/** Which form encoding an operation's request body uses, if any. */
export function formMode(contentType: string | undefined | null): "multipart" | "urlencoded" | null {
  if (!contentType) return null;
  if (contentType.includes("multipart/form-data")) return "multipart";
  if (contentType.includes("x-www-form-urlencoded")) return "urlencoded";
  return null;
}

/** A binary/file field: `format: binary`/`byte`, or an array of such. */
function isBinary(schema: Record<string, unknown> | undefined): boolean {
  if (!schema || typeof schema !== "object") return false;
  if (schema.format === "binary" || schema.format === "byte") return true;
  return schema.type === "array" && isBinary(schema.items as Record<string, unknown> | undefined);
}

/** Seed form rows from a multipart/urlencoded body schema. File fields become file pickers,
 * but only for multipart (urlencoded can't carry files). All schema rows start enabled;
 * empty ones are simply skipped at send. */
export function initialFormParts(op: Operation): FormPart[] {
  const mode = formMode(op.requestBody?.contentType);
  const schema = op.requestBody?.jsonSchema as Record<string, unknown> | undefined;
  const props = (schema?.properties && typeof schema.properties === "object" ? schema.properties : {}) as Record<string, Record<string, unknown>>;
  const required = new Set(Array.isArray(schema?.required) ? (schema!.required as string[]) : []);
  return Object.entries(props).map(([name, propSchema]) => ({
    id: nextId(),
    name,
    kind: mode === "multipart" && isBinary(propSchema) ? "file" : "text",
    value: "",
    files: [],
    enabled: true,
    fromSchema: true,
    required: required.has(name),
    schema: propSchema,
  }));
}

export function newAdHocPart(kind: FormPartKind = "text"): FormPart {
  return { id: nextId(), name: "", kind, value: "", files: [], enabled: true, fromSchema: false, required: false };
}

/** Enabled, named rows with content, ready to append to a multipart body. Text values are
 * interpolated against the profile's variables; files pass through untouched. */
export function toMultipartParts(parts: FormPart[], variables: Record<string, string>): MultipartSendPart[] {
  const out: MultipartSendPart[] = [];
  for (const p of parts) {
    if (!p.enabled || !p.name.trim()) continue;
    if (p.kind === "file") {
      if (p.files.length) out.push({ name: p.name.trim(), files: p.files });
    } else if (p.value !== "") {
      out.push({ name: p.name.trim(), value: interpolateString(p.value, variables) });
    }
  }
  return out;
}

/** Serialize enabled text rows to an application/x-www-form-urlencoded string. */
export function toUrlEncoded(parts: FormPart[], variables: Record<string, string>): string {
  const usp = new URLSearchParams();
  for (const p of parts) {
    if (!p.enabled || !p.name.trim() || p.kind === "file" || p.value === "") continue;
    usp.append(p.name.trim(), interpolateString(p.value, variables));
  }
  return usp.toString();
}
