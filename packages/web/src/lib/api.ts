import type { SpecMeta, Operation, ProxyRequest, ProxyMultipartMeta, ProxyResponse, ProxyError } from "@swaggy/shared";

export type ProxyResult = { ok: true; response: ProxyResponse } | { ok: false; error: ProxyError };

/** A part of a multipart body: a text field (`value`) or a file field (`files`). */
export type MultipartSendPart = { name: string; value?: string; files?: File[] };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

export const getSpecs = () => getJson<SpecMeta[]>("/api/specs");
export const getOperations = () => getJson<Operation[]>("/api/operations");

export async function sendProxy(req: ProxyRequest): Promise<ProxyResult> {
  const res = await fetch("/api/proxy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const json = await res.json();
  if (res.ok) return { ok: true, response: json as ProxyResponse };
  return { ok: false, error: json as ProxyError };
}

/** Send a real multipart/form-data request (files can't ride in the JSON body). The request
 * metadata goes in a `__meta` part; each field/file becomes its own part. The browser sets
 * the multipart content-type + boundary, so we deliberately don't set it. */
export async function sendProxyMultipart(meta: ProxyMultipartMeta, parts: MultipartSendPart[]): Promise<ProxyResult> {
  const fd = new FormData();
  fd.append("__meta", JSON.stringify(meta));
  for (const p of parts) {
    if (p.files) for (const f of p.files) fd.append(p.name, f, f.name);
    else if (p.value !== undefined) fd.append(p.name, p.value);
  }
  const res = await fetch("/api/proxy/multipart", { method: "POST", body: fd });
  const json = await res.json();
  if (res.ok) return { ok: true, response: json as ProxyResponse };
  return { ok: false, error: json as ProxyError };
}
