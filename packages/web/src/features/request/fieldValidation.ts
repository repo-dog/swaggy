import type { Param } from "@swaggy/shared";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a single parameter value against the rules derived from its OpenAPI
 * schema (type, enum, format, min/max, length, pattern). Returns an error
 * message, or null when the value is valid.
 *
 * Empty/undefined values are treated as "nothing to validate" — required-ness
 * is enforced separately in validateInputs so error messages don't compete.
 */
export function validateParam(param: Param, value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    for (const v of value) {
      const e = validateParam(param, v);
      if (e) return e;
    }
    return null;
  }
  if (value === undefined || value === "") return null;

  // A value containing a {{name}} template can't be schema-checked pre-resolution;
  // the resolved value is what actually gets sent, so treat it as valid here.
  if (/\{\{\s*[\w.-]+\s*\}\}/.test(value)) return null;

  const schema = (param.schema ?? {}) as Record<string, unknown>;

  const enumVals = schema.enum;
  if (Array.isArray(enumVals) && enumVals.length > 0) {
    if (!enumVals.map((v) => String(v)).includes(value)) {
      return `must be one of: ${enumVals.join(", ")}`;
    }
  }

  const type = schema.type;
  if (type === "integer" || type === "number") {
    const n = Number(value);
    if (value.trim() === "" || Number.isNaN(n)) return "must be a number";
    if (type === "integer" && !Number.isInteger(n)) return "must be an integer";
    if (typeof schema.minimum === "number" && n < schema.minimum) return `must be ≥ ${schema.minimum}`;
    if (typeof schema.maximum === "number" && n > schema.maximum) return `must be ≤ ${schema.maximum}`;
    return null;
  }

  if (type === "boolean") {
    if (value !== "true" && value !== "false") return "must be true or false";
    return null;
  }

  // string / default
  if (typeof schema.minLength === "number" && value.length < schema.minLength) {
    return `must be at least ${schema.minLength} characters`;
  }
  if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
    return `must be at most ${schema.maxLength} characters`;
  }
  if (typeof schema.pattern === "string") {
    try {
      if (!new RegExp(schema.pattern).test(value)) return `must match ${schema.pattern}`;
    } catch {
      /* ignore an unparseable pattern */
    }
  }
  switch (schema.format) {
    case "email":
      if (!EMAIL.test(value)) return "must be a valid email";
      break;
    case "uri":
    case "url":
      try {
        new URL(value);
      } catch {
        return "must be a valid URL";
      }
      break;
    case "uuid":
      if (!UUID.test(value)) return "must be a valid UUID";
      break;
    case "date":
      if (!DATE.test(value) || Number.isNaN(Date.parse(value))) return "must be a date (YYYY-MM-DD)";
      break;
    case "date-time":
      if (Number.isNaN(Date.parse(value))) return "must be a valid date-time";
      break;
    default:
      break;
  }
  return null;
}
