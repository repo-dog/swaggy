// {{name}} template references. Names allow word chars, dots and dashes.
const TOKEN = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** Own-property check — avoids matching inherited Object.prototype keys like `toString`. */
const has = (vars: Record<string, string>, name: string) => Object.prototype.hasOwnProperty.call(vars, name);

/** True if the string contains at least one {{ }} reference. */
export function hasTemplate(s: string): boolean {
  TOKEN.lastIndex = 0;
  return TOKEN.test(s);
}

/** Replace {{name}} with the variable's value; unknown names are left untouched. */
export function interpolateString(s: string, vars: Record<string, string>): string {
  return s.replace(TOKEN, (match, name) => (has(vars, name) ? vars[name] : match));
}

/** Recursively interpolate every string in a value (strings, arrays, object values). */
export function interpolateDeep<T>(value: T, vars: Record<string, string>): T {
  if (typeof value === "string") return interpolateString(value, vars) as T;
  if (Array.isArray(value)) return value.map((v) => interpolateDeep(v, vars)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolateDeep(v, vars);
    return out as T;
  }
  return value;
}

/** Distinct {{name}} references found anywhere in the values that have no matching variable. */
export function unresolvedRefsDeep(values: unknown[], vars: Record<string, string>): string[] {
  const missing = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      TOKEN.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = TOKEN.exec(value))) if (!has(vars, m[1])) missing.add(m[1]);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  values.forEach(walk);
  return [...missing];
}
