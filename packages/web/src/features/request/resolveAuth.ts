import type { Operation, SecurityScheme } from "@swaggy/shared";
import type { AuthValue } from "../../store/store.types.js";

/** Base64-encode a UTF-8 string (btoa only handles latin1). */
function base64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Resolve an operation's security requirements + the profile's entered credentials into the
 * concrete headers/query params to send. Applies every scheme referenced by the operation's
 * `security` for which a credential exists. Schemes are matched by key. */
/** Whether a credential is usable for a scheme (a value, or basic username/password). */
function hasCredential(scheme: SecurityScheme | undefined, val: AuthValue | undefined): boolean {
  if (!scheme || !val) return false;
  if (scheme.type === "http" && scheme.scheme === "basic") return Boolean(val.username || val.password);
  return Boolean(val.value);
}

export function resolveAuth(
  op: Pick<Operation, "security">,
  schemes: SecurityScheme[] | undefined,
  authValues: Record<string, AuthValue> | undefined,
): { headers: Record<string, string>; query: Record<string, string> } {
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};
  if (!schemes || !authValues || !op.security || op.security.length === 0) return { headers, query };

  // `op.security` is a list of ALTERNATIVES (OR); each entry is an AND of its scheme keys.
  // Apply exactly one alternative — the first that's fully satisfied by the available
  // credentials, otherwise the first — so we never merge credentials from a different
  // alternative than the one the user filled in.
  const find = (key: string) => schemes.find((s) => s.key === key);
  const chosen =
    op.security.find((req) => Object.keys(req).every((k) => hasCredential(find(k), authValues[k]))) ?? op.security[0];

  for (const key of Object.keys(chosen)) {
    const scheme = find(key);
    const val = authValues[key];
    if (!scheme || !val) continue;
    switch (scheme.type) {
      case "apiKey":
        if (val.value && scheme.paramName) {
          if (scheme.in === "query") query[scheme.paramName] = val.value;
          else if (scheme.in === "header") headers[scheme.paramName] = val.value;
          // cookie apiKeys aren't proxied here (browsers manage Cookie); skip.
        }
        break;
      case "http":
        if (scheme.scheme === "bearer" && val.value) headers["Authorization"] = `Bearer ${val.value}`;
        else if (scheme.scheme === "basic" && (val.username || val.password)) {
          headers["Authorization"] = `Basic ${base64(`${val.username ?? ""}:${val.password ?? ""}`)}`;
        }
        break;
      case "oauth2":
      case "openIdConnect":
        if (val.value) headers["Authorization"] = `Bearer ${val.value}`;
        break;
    }
  }
  return { headers, query };
}
