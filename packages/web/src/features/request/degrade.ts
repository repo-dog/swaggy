export function hasUnsupportedComposition(schema: any, depth = 0): boolean {
  if (!schema || typeof schema !== "object" || depth >= 8) return false;
  if (schema.oneOf || schema.anyOf || schema.allOf) return true;
  // Depth-bounded so a deeply-nested (or recursive) schema can't cause unbounded recursion.
  return Object.values(schema).some((v) => (typeof v === "object" ? hasUnsupportedComposition(v, depth + 1) : false));
}
