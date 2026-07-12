/** Shared field-metadata helpers used by both the param fields and the request-body form,
 * so a field shows its allowed values / constraints and whether it's required consistently. */

/** A short human hint for a field's schema: format + range/length limits. Enum choices are
 * intentionally omitted — those fields render as a dropdown that already lists the options. */
export function schemaHint(schema: Record<string, unknown> | undefined | null): string | null {
  if (!schema || typeof schema !== "object") return null;
  const bits: string[] = [];
  if (typeof schema.format === "string") bits.push(schema.format);
  if (typeof schema.minimum === "number") bits.push(`min ${schema.minimum}`);
  if (typeof schema.maximum === "number") bits.push(`max ${schema.maximum}`);
  if (typeof schema.minLength === "number") bits.push(`≥ ${schema.minLength} chars`);
  if (typeof schema.maxLength === "number") bits.push(`≤ ${schema.maxLength} chars`);
  return bits.length ? bits.join(" · ") : null;
}

/** A compact, human type label for a schema: `string`, `integer`, `array<string>`,
 * `array<object>`, `object`, or a union like `string | null`. Used by the schema outline. */
export function schemaTypeLabel(schema: Record<string, unknown> | undefined | null): string {
  if (!schema || typeof schema !== "object") return "any";
  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  if (schema.type === "array") {
    const items = schema.items && typeof schema.items === "object" ? schemaTypeLabel(schema.items as Record<string, unknown>) : "any";
    return `array<${items}>`;
  }
  if (typeof schema.type === "string") return schema.type;
  if (schema.properties) return "object";
  return "any";
}

/** A field's allowed values (enum) as display strings, or null if it has none. */
export function enumValues(schema: Record<string, unknown> | undefined | null): string[] | null {
  if (!schema || typeof schema !== "object" || !Array.isArray(schema.enum) || schema.enum.length === 0) return null;
  return schema.enum.map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
}

/** A field's declared default as a display string, or null if none is declared. */
export function defaultValueHint(schema: Record<string, unknown> | undefined | null): string | null {
  if (!schema || typeof schema !== "object" || !("default" in schema)) return null;
  const d = schema.default;
  return typeof d === "string" ? d : JSON.stringify(d);
}

/** A small pill marking a field as required or optional, so its status is always explicit. */
export function RequiredBadge({ required }: { required?: boolean }) {
  return required ? (
    <span className="rounded bg-danger/10 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger dark:bg-danger/20">
      required
    </span>
  ) : (
    <span className="rounded bg-surface-muted px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-content-muted">
      optional
    </span>
  );
}
