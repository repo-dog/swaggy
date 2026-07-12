import { request as undiciRequest, fetch as undiciFetch, FormData as UndiciFormData, File as UndiciFile } from "undici";
import { STATUS_CODES } from "node:http";
import type { ProxyRequest, ProxyResponse, ProxyError, ProxyMultipartMeta } from "@swaggy/shared";

// A body is JSON if the content type is application/json, any `+json` structured-syntax
// suffix (application/problem+json, hal+json, vnd.api+json, ld+json, …), or */json
// (e.g. text/json) — see RFC 6839. Parsing these lets the UI render a formatted tree.
export function isJsonContentType(contentType: string): boolean {
  return /[/+]json\b/i.test(contentType);
}

export function buildTargetUrl(req: ProxyRequest): string {
  let path = req.path;
  for (const [k, v] of Object.entries(req.pathParams)) {
    path = path.replaceAll(`{${k}}`, encodeURIComponent(v));
  }
  const full = new URL(req.server.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(req.query)) {
    if (Array.isArray(v)) v.forEach((item) => full.searchParams.append(k, item));
    else full.searchParams.append(k, v);
  }
  return full.toString();
}

type ProxyOutcome =
  | { ok: true; value: ProxyResponse }
  | { ok: false; status: number; error: ProxyError };

const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;

// Headers that describe a single hop and must not be forwarded to the upstream.
const HOP_BY_HOP = new Set([
  "host", "content-length", "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade",
]);

type TargetResolution =
  | { ok: true; target: string; targetUrl: URL }
  | { ok: false; status: number; error: ProxyError };

// Validate the server URL and the RESOLVED target host against the allow-list, rejecting
// embedded credentials. path/pathParams are concatenated as raw strings, so a crafted path
// could shift the authority — hence the second check on the fully-built target.
function resolveTarget(
  req: Pick<ProxyRequest, "server" | "path" | "pathParams" | "query">,
  allowedHosts: Set<string>,
): TargetResolution {
  let serverUrl: URL;
  try {
    serverUrl = new URL(req.server);
  } catch {
    return { ok: false, status: 400, error: { error: { kind: "bad_request", message: "Invalid server URL" } } };
  }
  if (serverUrl.username || serverUrl.password) {
    return { ok: false, status: 400, error: { error: { kind: "bad_request", message: "Credentials in the server URL are not allowed" } } };
  }
  if (!allowedHosts.has(serverUrl.host)) {
    return { ok: false, status: 403, error: { error: { kind: "forbidden", message: `Host not allowed: ${serverUrl.host}` } } };
  }
  const target = buildTargetUrl(req as ProxyRequest);
  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return { ok: false, status: 400, error: { error: { kind: "bad_request", message: "Invalid target URL" } } };
  }
  if (targetUrl.username || targetUrl.password || !allowedHosts.has(targetUrl.host)) {
    return { ok: false, status: 403, error: { error: { kind: "forbidden", message: `Host not allowed: ${targetUrl.host}` } } };
  }
  return { ok: true, target, targetUrl };
}

// Classify a thrown transport error into the ProxyError taxonomy, preferring the stable error
// code (undici request) or cause code / AbortSignal name (undici fetch) over message text.
function classifyError(e: unknown): ProxyError {
  const err = e as { message?: string; code?: string; name?: string; cause?: { code?: string } };
  const msg = err?.message ?? String(e);
  const code = err?.code ?? err?.cause?.code ?? "";
  const kind =
    err?.name === "TimeoutError" || /TIMEOUT/.test(code) || /timeout/i.test(msg)
      ? "timeout"
      : code === "ENOTFOUND" || code === "EAI_AGAIN" || /getaddrinfo|ENOTFOUND|dns/i.test(msg)
        ? "dns"
        : "connection";
  return { error: { kind, message: msg } };
}

const readContentType = (headers: Record<string, string>): string => {
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === "content-type") return v;
  return "";
};

// Build the ProxyResponse from a completed upstream read. JSON bodies are parsed so the UI can
// render a tree; malformed/partial JSON falls back to raw text.
function buildProxyResponse(started: number, status: number, headers: Record<string, string>, bodyBuf: Buffer): ProxyResponse {
  const text = bodyBuf.toString("utf8");
  let body: unknown = text;
  if (text && isJsonContentType(readContentType(headers))) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return {
    status,
    // undici doesn't expose the HTTP reason phrase; derive the standard one.
    statusText: STATUS_CODES[status] ?? "",
    headers,
    body,
    durationMs: Date.now() - started,
    bodySize: Buffer.byteLength(text),
  };
}

// Read a WHATWG ReadableStream (an undici fetch response body) up to the cap, so a
// huge/hostile upstream can't OOM the server.
async function readCappedWebStream(stream: ReadableStream<Uint8Array> | null): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const buf = Buffer.from(value);
      size += buf.length;
      if (size > MAX_RESPONSE_BYTES) { reader.cancel().catch(() => {}); break; }
      chunks.push(buf);
    }
  }
  return Buffer.concat(chunks);
}

// A single part of an outgoing multipart/form-data body: a text field, or a file when
// `filename` is set.
export type MultipartPart = { name: string; data: Buffer; filename?: string; contentType?: string };

export async function executeProxy(
  req: ProxyRequest,
  opts: { allowedHosts: Set<string>; timeoutMs: number; request?: typeof undiciRequest },
): Promise<ProxyOutcome> {
  const resolved = resolveTarget(req, opts.allowedHosts);
  if (!resolved.ok) return resolved;
  const doRequest = opts.request ?? undiciRequest;

  const outHeaders: Record<string, string> = {};
  let hasContentType = false;
  for (const [k, v] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    outHeaders[k] = v;
    if (k.toLowerCase() === "content-type") hasContentType = true;
  }
  const hasBody = req.body !== undefined;
  // String bodies (e.g. application/x-www-form-urlencoded) go on the wire verbatim; objects
  // and arrays are JSON-encoded. Default the content-type to match when none was supplied.
  const bodyIsString = typeof req.body === "string";
  if (hasBody && !hasContentType) outHeaders["content-type"] = bodyIsString ? "text/plain" : "application/json";

  const started = Date.now();
  try {
    const res = await doRequest(resolved.target, {
      method: req.method as any,
      headers: outHeaders,
      body: hasBody ? (bodyIsString ? (req.body as string) : JSON.stringify(req.body)) : undefined,
      headersTimeout: opts.timeoutMs,
      bodyTimeout: opts.timeoutMs,
    });
    // Bounded read so a huge/hostile upstream response can't OOM the server; beyond the cap we
    // stop and return what we have (truncated JSON simply falls back to raw text).
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res.body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > MAX_RESPONSE_BYTES) { res.body.destroy?.(); break; }
      chunks.push(buf);
    }
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) {
      // Set-Cookie is legitimately multi-valued and must NOT be comma-joined (Expires contains
      // commas); show one per line. Other multi-valued headers join with ", ".
      if (Array.isArray(v)) headers[k] = v.join(k.toLowerCase() === "set-cookie" ? "\n" : ", ");
      else headers[k] = String(v ?? "");
    }
    return { ok: true, value: buildProxyResponse(started, res.statusCode, headers, Buffer.concat(chunks)) };
  } catch (e) {
    return { ok: false, status: 502, error: classifyError(e) };
  }
}

// Forward a real multipart/form-data request (Option B for file uploads): parts are
// reassembled into an undici FormData and sent with fetch, which derives the boundary. The
// same host allow-list, size cap, and error classification as executeProxy apply.
export async function executeMultipartProxy(
  meta: ProxyMultipartMeta,
  parts: MultipartPart[],
  opts: { allowedHosts: Set<string>; timeoutMs: number; fetch?: typeof undiciFetch },
): Promise<ProxyOutcome> {
  const resolved = resolveTarget(meta, opts.allowedHosts);
  if (!resolved.ok) return resolved;
  const doFetch = opts.fetch ?? undiciFetch;

  const form = new UndiciFormData();
  for (const p of parts) {
    if (p.filename !== undefined) {
      form.append(p.name, new UndiciFile([p.data], p.filename, p.contentType ? { type: p.contentType } : undefined), p.filename);
    } else {
      form.append(p.name, p.data.toString("utf8"));
    }
  }

  // Forward the caller's headers except content-type — fetch sets it (with the boundary) from
  // the FormData. Hop-by-hop headers are dropped as usual.
  const outHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta.headers)) {
    const lk = k.toLowerCase();
    if (HOP_BY_HOP.has(lk) || lk === "content-type") continue;
    outHeaders[k] = v;
  }

  const started = Date.now();
  try {
    const res = await doFetch(resolved.target, {
      method: meta.method,
      headers: outHeaders,
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    const bodyBuf = await readCappedWebStream(res.body as ReadableStream<Uint8Array> | null);
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    // getSetCookie() preserves individual Set-Cookie values; join one-per-line like executeProxy.
    const setCookie = (res.headers as { getSetCookie?: () => string[] }).getSetCookie?.();
    if (setCookie && setCookie.length) headers["set-cookie"] = setCookie.join("\n");
    return { ok: true, value: buildProxyResponse(started, res.status, headers, bodyBuf) };
  } catch (e) {
    return { ok: false, status: 502, error: classifyError(e) };
  }
}
