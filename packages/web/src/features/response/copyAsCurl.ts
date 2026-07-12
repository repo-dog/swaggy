import type { ProxyRequest } from "@swaggy/shared";

function resolveUrl(req: ProxyRequest): string {
  let path = req.path;
  for (const [k, v] of Object.entries(req.pathParams)) path = path.replaceAll(`{${k}}`, encodeURIComponent(v));
  const url = new URL(req.server.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(req.query)) {
    if (Array.isArray(v)) v.forEach((i) => url.searchParams.append(k, i));
    else url.searchParams.append(k, v);
  }
  return url.toString();
}

export function toCurl(req: ProxyRequest): string {
  const parts = [`curl -X ${req.method}`, `'${resolveUrl(req)}'`];
  for (const [k, v] of Object.entries(req.headers)) parts.push(`-H '${k}: ${v}'`);
  if (req.body !== undefined && req.method !== "GET" && req.method !== "HEAD") {
    parts.push(`-d '${JSON.stringify(req.body)}'`);
  }
  return parts.join(" ");
}
