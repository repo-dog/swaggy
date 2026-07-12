import type { Operation, Param, SpecMeta, SecurityScheme } from "@swaggy/shared";

export type NormalizedSpec = {
  specId: string;
  title: string;
  version: string;
  serverUrls: string[];
  operations: Operation[];
  description?: string;
  contact?: SpecMeta["contact"];
  license?: SpecMeta["license"];
  externalDocs?: SpecMeta["externalDocs"];
  securitySchemes?: SecurityScheme[];
  serverDefs?: SpecMeta["serverDefs"];
  schemas?: SpecMeta["schemas"];
};

// Named component schemas (3.x components.schemas) / definitions (2.0), dereferenced and
// made acyclic for the models browser.
export function normalizeSchemas(deref: any): SpecMeta["schemas"] {
  const src = deref?.components?.schemas ?? deref?.definitions;
  if (!src || typeof src !== "object") return undefined;
  const out = Object.entries<any>(src).map(([name, schema]) => ({ name, schema: stripCycles(schema) }));
  return out.length > 0 ? out : undefined;
}

// OpenAPI 2.0 oauth2 `flow` value → 3.x flow name.
const V2_OAUTH_FLOW: Record<string, string> = {
  implicit: "implicit",
  password: "password",
  application: "clientCredentials",
  accessCode: "authorizationCode",
};

// Normalize 2.0 `securityDefinitions` and 3.x `components.securitySchemes` into one shape.
export function normalizeSecuritySchemes(deref: any): SecurityScheme[] {
  const src = deref?.components?.securitySchemes ?? deref?.securityDefinitions;
  if (!src || typeof src !== "object") return [];
  const out: SecurityScheme[] = [];
  for (const [key, raw] of Object.entries<any>(src)) {
    if (!raw || typeof raw !== "object") continue;
    switch (raw.type) {
      case "apiKey":
        out.push({ key, type: "apiKey", description: raw.description, in: raw.in, paramName: raw.name });
        break;
      case "basic": // OpenAPI 2.0
        out.push({ key, type: "http", scheme: "basic", description: raw.description });
        break;
      case "http": // OpenAPI 3.x
        out.push({ key, type: "http", scheme: raw.scheme, bearerFormat: raw.bearerFormat, description: raw.description });
        break;
      case "oauth2": {
        const flows: Record<string, any> = {};
        if (raw.flows && typeof raw.flows === "object") {
          for (const [name, f] of Object.entries<any>(raw.flows)) {
            flows[name] = { authorizationUrl: f?.authorizationUrl, tokenUrl: f?.tokenUrl, refreshUrl: f?.refreshUrl, scopes: f?.scopes ?? {} };
          }
        } else if (typeof raw.flow === "string") {
          flows[V2_OAUTH_FLOW[raw.flow] ?? raw.flow] = {
            authorizationUrl: raw.authorizationUrl,
            tokenUrl: raw.tokenUrl,
            scopes: raw.scopes ?? {},
          };
        }
        out.push({ key, type: "oauth2", description: raw.description, flows });
        break;
      }
      case "openIdConnect":
        out.push({ key, type: "openIdConnect", description: raw.description, openIdConnectUrl: raw.openIdConnectUrl });
        break;
    }
  }
  return out;
}

const METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"] as const;

// Resolve the base server URL(s) for a spec, trying, in order:
//   1. the spec's `servers` (OpenAPI 3.x; absolute kept, relative resolved against the spec URL)
//   2. the OpenAPI 2.0 `host` (+ `basePath`, `schemes[0]`)
//   3. the spec URL's own directory (e.g. .../api/v3/openapi.json -> .../api/v3)
//   4. the configured `defaultServer` (only reachable when the spec URL is unusable)
//   5. none
// Substitute {variable} placeholders in a server URL template with the variables' declared
// defaults, so a templated OpenAPI 3 server (e.g. https://{host}/{basePath}) resolves to a
// usable concrete URL instead of being dropped.
export function applyServerDefaults(url: string, variables: any): string {
  if (!variables || typeof variables !== "object") return url;
  return url.replace(/\{([^}]+)\}/g, (whole, name) => {
    const v = variables[name];
    return v && typeof v.default === "string" ? v.default : whole;
  });
}

export function resolveServers(
  deref: any,
  specUrl: string,
  defaultServer?: string | null,
): string[] {
  const trim = (u: string) => u.replace(/\/$/, "");

  // 1. OpenAPI 3.x servers (variable placeholders filled with their defaults)
  const list = Array.isArray(deref?.servers) ? deref.servers : [];
  const resolved = list
    .map((s: any) => (typeof s?.url === "string" ? applyServerDefaults(s.url, s.variables) : s?.url))
    .filter((u: any): u is string => typeof u === "string" && u.length > 0)
    .map((u: string) => {
      try {
        return trim(new URL(u).toString());
      } catch {
        try {
          return trim(new URL(u, specUrl).toString());
        } catch {
          return null;
        }
      }
    })
    .filter((u: string | null): u is string => u != null);
  if (resolved.length > 0) return resolved;

  // 2. OpenAPI 2.0 host + basePath + schemes
  if (typeof deref?.host === "string" && deref.host.length > 0) {
    let scheme: string | undefined = Array.isArray(deref.schemes) ? deref.schemes[0] : undefined;
    if (!scheme) {
      try {
        scheme = new URL(specUrl).protocol.replace(":", "");
      } catch {
        scheme = "https";
      }
    }
    const basePath = typeof deref.basePath === "string" ? deref.basePath : "";
    return [trim(`${scheme}://${deref.host}${basePath}`)];
  }

  // 3. Spec URL directory (the folder the spec file lives in)
  try {
    return [trim(new URL(".", specUrl).toString())];
  } catch {
    // unusable spec URL — fall through
  }

  // 4. configured defaultServer
  if (defaultServer != null) return [trim(defaultServer)];

  // 5. none
  return [];
}

// SwaggerParser.dereference inlines every $ref, which turns a recursive schema (e.g. a
// springdoc `/v3/api-docs` model whose field points back at itself) into a *circular* JS
// object. Those can't be JSON-serialized, so the API response for /api/operations would
// throw "Converting circular structure to JSON" at send time. Deep-clone each extracted
// schema, replacing any reference back to an ancestor on the current path with a finite
// stub — keeping the dereferenced (no-$ref) shape the UI consumes while making it acyclic.
export function stripCycles<T>(value: T, path: Set<object> = new Set()): T {
  if (value === null || typeof value !== "object") return value;
  const obj = value as unknown as object;
  if (path.has(obj)) {
    const src = obj as Record<string, unknown>;
    const stub: Record<string, unknown> = {};
    if (src.type !== undefined) stub.type = src.type;
    if (src.title !== undefined) stub.title = src.title;
    if (src.description !== undefined) stub.description = src.description;
    return stub as unknown as T;
  }
  path.add(obj);
  const result = Array.isArray(value)
    ? value.map((v) => stripCycles(v, path))
    : Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, stripCycles(v, path)]));
  path.delete(obj);
  return result as unknown as T;
}

// OpenAPI 3 parameters carry their type in a nested `schema`; OpenAPI 2.0 parameters put
// `type`/`format`/`enum`/`items`/`default` and the validation keywords directly on the
// parameter. Normalize both into a single schema object so the UI can render the right
// control (boolean toggle, enum dropdown, number/array inputs) and seed default values —
// otherwise 2.0 params fall back to a plain text input and lose their defaults.
const PARAM_SCHEMA_KEYS = [
  "type", "format", "enum", "items", "default", "example",
  "minimum", "maximum", "minLength", "maxLength", "pattern",
] as const;

function paramSchema(raw: any): any {
  if (raw?.schema && typeof raw.schema === "object") return stripCycles(raw.schema);
  const schema: Record<string, unknown> = {};
  for (const key of PARAM_SCHEMA_KEYS) if (raw?.[key] !== undefined) schema[key] = raw[key];
  return stripCycles(schema);
}

function toParam(raw: any): Param {
  const schema = paramSchema(raw);
  return {
    name: raw.name,
    in: raw.in,
    schema,
    required: raw.in === "path" ? true : Boolean(raw.required),
    description: raw.description ?? schema.description,
    example: raw.example ?? schema.example,
    default: schema.default,
  };
}

const FORM_TYPES = ["multipart/form-data", "application/x-www-form-urlencoded"];

// Build an object schema from Swagger 2.0 `in: "formData"` parameters, mirroring the OpenAPI
// 3.x form-body shape the UI expects. A `type: "file"` param becomes `{type: string, format:
// binary}` so the form renders a file picker.
function schemaFromFormDataParams(params: any[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of params) {
    if (!p?.name) continue;
    properties[p.name] = p.type === "file"
      ? { type: "string", format: "binary", description: p.description }
      : { type: p.type, format: p.format, enum: p.enum, default: p.default, items: p.items, description: p.description };
    if (p.required) required.push(p.name);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

// Resolve the request body for an operation across OpenAPI 3.x
// (`op.requestBody.content[...]`) and Swagger 2.0 (a `in: "body"` param with `schema`, or
// `in: "formData"` params). JSON is preferred; multipart/form-data and
// x-www-form-urlencoded are also surfaced so the UI can render a form (with file uploads).
function resolveBody(op: any, deref: any): Operation["requestBody"] {
  // OpenAPI 3.x — match application/json or any +json / */json media type (e.g. vnd.api+json),
  // then fall back to the two form encodings.
  const content = op?.requestBody?.content;
  if (content && typeof content === "object") {
    const keys = Object.keys(content);
    const jsonKey = keys.find((k) => /[/+]json\b/i.test(k));
    if (jsonKey) return { contentType: jsonKey, jsonSchema: stripCycles(content[jsonKey]?.schema ?? {}) };
    const formKey = FORM_TYPES.find((t) => keys.includes(t));
    if (formKey) return { contentType: formKey, jsonSchema: stripCycles(content[formKey]?.schema ?? {}) };
  }

  // Swagger 2.0: a parameter with in: "body"
  const params: any[] = Array.isArray(op?.parameters) ? op.parameters : [];
  const bodyParam = params.find((p) => p?.in === "body");
  const consumes: string[] = Array.isArray(op?.consumes)
    ? op.consumes
    : Array.isArray(deref?.consumes)
      ? deref.consumes
      : [];
  if (bodyParam?.schema) {
    const contentType = consumes.find((c) => typeof c === "string" && c.includes("json")) ?? "application/json";
    return { contentType, jsonSchema: stripCycles(bodyParam.schema) };
  }

  // Swagger 2.0: in: "formData" params (the 2.0 way to describe form / file-upload bodies).
  const formDataParams = params.filter((p) => p?.in === "formData");
  if (formDataParams.length > 0) {
    const hasFile = formDataParams.some((p) => p.type === "file");
    const contentType = consumes.find((c) => FORM_TYPES.includes(c))
      ?? (hasFile ? "multipart/form-data" : "application/x-www-form-urlencoded");
    return { contentType, jsonSchema: schemaFromFormDataParams(formDataParams) };
  }

  return null;
}

// Best single example for a documented response, across OpenAPI 3.x (media-type `example` or
// the first of `examples`) and Swagger 2.0 (response-level `examples` keyed by media type).
function responseExample(def: any, ct: string | null): unknown {
  const mt = ct && def?.content ? def.content[ct] : undefined;
  if (mt?.example !== undefined) return mt.example;
  if (mt?.examples && typeof mt.examples === "object") {
    const first = Object.values(mt.examples)[0] as any;
    return first && typeof first === "object" && "value" in first ? first.value : first;
  }
  if (def?.example !== undefined) return def.example;
  if (def?.examples && typeof def.examples === "object") return Object.values(def.examples)[0];
  return undefined;
}

function toResponses(responses: any): Operation["responses"] {
  if (!responses) return [];
  return Object.entries(responses).map(([status, def]: [string, any]) => {
    const content = def?.content;
    // OpenAPI 3.x: media types under `content`. Swagger 2.0: a `schema` directly on the response.
    // Prefer a JSON media type (so a spec listing xml first still surfaces the JSON schema).
    const keys = content ? Object.keys(content) : [];
    const ct = keys.find((k) => /[/+]json\b/i.test(k)) ?? keys[0] ?? null;
    const schema = content && ct ? content[ct]?.schema ?? null : def?.schema ?? null;
    const example = responseExample(def, ct);
    return {
      status,
      contentType: ct,
      jsonSchema: schema != null ? stripCycles(schema) : null,
      description: typeof def?.description === "string" ? def.description : undefined,
      example: example !== undefined ? stripCycles(example) : undefined,
    };
  });
}

export function normalizeSpec(
  deref: any,
  specName: string,
  specUrl: string,
  defaultServer?: string | null,
): NormalizedSpec {
  const title = deref?.info?.title ?? specName;
  const version = deref?.info?.version ?? "unknown";
  const serverUrls = resolveServers(deref, specUrl, defaultServer);
  // Spec-wide default security requirements; an operation without its own `security` inherits these.
  const globalSecurity = Array.isArray(deref?.security) ? deref.security : undefined;
  const operations: Operation[] = [];
  const seenIds = new Set<string>();

  for (const [path, pathItem] of Object.entries<any>(deref?.paths ?? {})) {
    const pathParams: any[] = pathItem?.parameters ?? [];
    for (const method of METHODS) {
      const op = pathItem?.[method];
      if (!op) continue;
      const merged = mergeParams(pathParams, op.parameters ?? []).map(toParam);
      // Prefer operationId; fall back to method:path. Disambiguate duplicate operationIds
      // (invalid but seen in the wild) so the UI's id-keyed selection/routing stays unique.
      let id = op.operationId ? `${specName}:${op.operationId}` : `${specName}:${method.toUpperCase()}:${path}`;
      if (seenIds.has(id)) id = `${specName}:${method.toUpperCase()}:${path}`;
      seenIds.add(id);
      operations.push({
        id,
        specId: specName,
        specTitle: title,
        method: method.toUpperCase(),
        path,
        summary: op.summary ?? "",
        description: op.description ?? "",
        tags: op.tags ?? [],
        servers: serverUrls,
        pathParams: merged.filter((p) => p.in === "path"),
        queryParams: merged.filter((p) => p.in === "query"),
        headerParams: merged.filter((p) => p.in === "header"),
        requestBody: resolveBody(op, deref),
        responses: toResponses(op.responses),
        deprecated: op.deprecated === true ? true : undefined,
        externalDocs:
          op.externalDocs && typeof op.externalDocs.url === "string"
            ? { url: op.externalDocs.url, description: op.externalDocs.description }
            : undefined,
        // Operation `security` overrides the global default; `[]` explicitly means "no auth".
        security: Array.isArray(op.security) ? op.security : globalSecurity,
      });
    }
  }

  const info = deref?.info ?? {};
  const extDocs =
    deref?.externalDocs && typeof deref.externalDocs.url === "string"
      ? { url: deref.externalDocs.url, description: deref.externalDocs.description }
      : undefined;
  return {
    specId: specName,
    title,
    version,
    serverUrls,
    operations,
    description: typeof info.description === "string" ? info.description : undefined,
    contact: info.contact && typeof info.contact === "object" ? info.contact : undefined,
    license: info.license && typeof info.license === "object" ? info.license : undefined,
    externalDocs: extDocs,
    securitySchemes: normalizeSecuritySchemes(deref),
    serverDefs: Array.isArray(deref?.servers)
      ? deref.servers
          .filter((s: any) => typeof s?.url === "string" && s.url.length > 0)
          .map((s: any) => ({ url: s.url, description: s.description, variables: s.variables }))
      : undefined,
    schemas: normalizeSchemas(deref),
  };
}

// Operation-level params override path-level params with the same name+in.
function mergeParams(pathLevel: any[], opLevel: any[]): any[] {
  const key = (p: any) => `${p.in}:${p.name}`;
  const map = new Map<string, any>();
  for (const p of pathLevel) map.set(key(p), p);
  for (const p of opLevel) map.set(key(p), p);
  return [...map.values()];
}
