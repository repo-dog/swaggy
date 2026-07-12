import type { ProxyResponse, ProxyError } from "@swaggy/shared";

// A common (profile) header. `enabled` is optional for backward compatibility with headers
// persisted before this flag existed — treat a missing value as enabled; only `false` disables.
export type CommonHeader = { name: string; value: string; enabled?: boolean };

/** An ad-hoc request header the user adds beyond the spec's declared header params. */
export type CustomHeader = { name: string; value: string };

/** Values the user has filled into a request form. Persisted per operation. */
export type RequestInputs = {
  server: string;
  pathParams: Record<string, string>;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  // Extra headers not declared by the spec. Persisted with the inputs; Reset clears their
  // values but keeps the rows.
  customHeaders?: CustomHeader[];
  body?: unknown;
};

/** The outcome of a proxied request, as returned by the proxy endpoint. */
export type ProxyResult = { ok: true; response: ProxyResponse } | { ok: false; error: ProxyError };

/** The last request outcome for an operation, retained so it survives navigation and refresh. */
export type StoredResponse =
  | { kind: "result"; result: ProxyResult }
  | { kind: "network_error"; message: string };

/** A named, saved snapshot of everything the user filled into a request. */
export type Snapshot = {
  id: string;
  name: string;
  createdAt: number;
  inputs: RequestInputs;
};

// A user-entered credential for one security scheme (by scheme key). `value` holds a bearer
// token, apiKey value, or OAuth2 access token; basic auth uses username/password. OAuth2 also
// persists the client config used to obtain the token (clientId/secret/scope).
export type AuthValue = {
  value?: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
};

export type Profile = {
  profileId: string;
  name: string;
  operationIds: string[];
  // Per-security-scheme credentials, keyed by scheme key. Optional for backward compatibility.
  authValues?: Record<string, AuthValue>;
  // Headers sent with every request in this profile whose spec declares a header of the
  // same name (auth tokens, tracing headers, etc.). Named `commonHeaders` to match the UI.
  // Optional so profiles persisted before the `auth` → `commonHeaders` rename still load
  // (read defensively as `profile.commonHeaders ?? []`).
  commonHeaders?: CommonHeader[];
  // Named values reusable across requests via {{name}} templating. Captured from
  // responses or edited by hand. Optional so profiles persisted before this existed
  // still load (read defensively as `profile.variables ?? {}`).
  variables?: Record<string, string>;
  // Request/response log for this profile, newest first. Per-profile so switching
  // profiles shows only that profile's activity. Optional for backward compatibility
  // with profiles persisted before history moved onto the profile (read as `?? []`).
  history?: HistoryEntry[];
};

export type HistoryEntry = {
  id: string;
  operationId: string;
  timestamp: number;
  durationMs: number;
  request: {
    server: string;
    pathParams: Record<string, string>;
    query: Record<string, string | string[]>;
    headers: Record<string, string>;
    // Ad-hoc headers the user added beyond the spec. Stored so reopening a history entry
    // restores them (like `headers`, these are user-entered, not auth-merged secrets).
    customHeaders?: CustomHeader[];
    body?: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
    bodyTruncated: boolean;
  };
};

export type Mode = "simple" | "advanced";

/** "system" follows the OS `prefers-color-scheme`; light/dark are explicit overrides. */
export type Theme = "light" | "dark" | "system";
