import { z } from "zod";

export const ParamSchema = z.object({
  name: z.string(),
  in: z.enum(["path", "query", "header"]),
  schema: z.unknown(),
  required: z.boolean(),
  description: z.string().optional(),
  example: z.unknown().optional(),
  default: z.unknown().optional(),
});

export const RequestBodySchema = z
  .object({ contentType: z.string(), jsonSchema: z.unknown() })
  .nullable();

export const ResponseDefSchema = z.object({
  status: z.string(),
  contentType: z.string().nullable(),
  jsonSchema: z.unknown().nullable(),
  // Documented response metadata (shown for reference; Swaggy does not validate responses).
  description: z.string().optional(),
  example: z.unknown().optional(),
});

export const ExternalDocsSchema = z.object({
  url: z.string(),
  description: z.string().optional(),
});

// A single OAuth2 flow, normalized across OpenAPI 2.0 (`flow` + urls at scheme level) and
// 3.x (`flows.<name>`). Flow name is the map key in SecurityScheme.flows.
export const OAuthFlowSchema = z.object({
  authorizationUrl: z.string().optional(),
  tokenUrl: z.string().optional(),
  refreshUrl: z.string().optional(),
  scopes: z.record(z.string()).default({}),
});

// A security scheme normalized into one shape regardless of spec version.
export const SecuritySchemeSchema = z.object({
  key: z.string(),
  type: z.enum(["apiKey", "http", "oauth2", "openIdConnect"]),
  description: z.string().optional(),
  // apiKey
  in: z.enum(["header", "query", "cookie"]).optional(),
  paramName: z.string().optional(),
  // http (scheme = "bearer" | "basic" | …)
  scheme: z.string().optional(),
  bearerFormat: z.string().optional(),
  // oauth2 — flow name (authorizationCode | implicit | password | clientCredentials) → flow
  flows: z.record(OAuthFlowSchema).optional(),
  // openIdConnect
  openIdConnectUrl: z.string().optional(),
});

// A security requirement: scheme key → required scopes. An operation's `security` is a list of
// these (any one alternative satisfies it).
export const SecurityRequirementSchema = z.record(z.array(z.string()));

export const OperationSchema = z.object({
  id: z.string(),
  specId: z.string(),
  specTitle: z.string(),
  method: z.string(),
  path: z.string(),
  summary: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  servers: z.array(z.string()),
  pathParams: z.array(ParamSchema),
  queryParams: z.array(ParamSchema),
  headerParams: z.array(ParamSchema),
  requestBody: RequestBodySchema,
  responses: z.array(ResponseDefSchema),
  // Optional, additive metadata (older normalized data simply omits these).
  deprecated: z.boolean().optional(),
  externalDocs: ExternalDocsSchema.optional(),
  // Security requirements that apply to this operation (already resolved against the spec's
  // global `security` default). Any one requirement in the list satisfies the operation.
  security: z.array(SecurityRequirementSchema).optional(),
});

export const ServerVariableSchema = z.object({
  default: z.string(),
  enum: z.array(z.string()).optional(),
  description: z.string().optional(),
});

// A server as declared (URL may be templated with {variable} placeholders).
export const ServerDefSchema = z.object({
  url: z.string(),
  description: z.string().optional(),
  variables: z.record(ServerVariableSchema).optional(),
});

export const SpecStatusSchema = z.enum(["ok", "stale", "error"]);

export const SpecMetaSchema = z.object({
  specId: z.string(),
  title: z.string(),
  version: z.string(),
  serverUrls: z.array(z.string()),
  operationCount: z.number(),
  lastRefreshedAt: z.string().nullable(),
  status: SpecStatusSchema,
  // Optional info block from the spec (additive; older specs simply omit these).
  description: z.string().optional(),
  contact: z.object({ name: z.string().optional(), url: z.string().optional(), email: z.string().optional() }).optional(),
  license: z.object({ name: z.string().optional(), url: z.string().optional() }).optional(),
  externalDocs: ExternalDocsSchema.optional(),
  securitySchemes: z.array(SecuritySchemeSchema).optional(),
  // Declared servers with their (possibly templated) URLs and variables. serverUrls above
  // holds the concrete URLs with variable defaults applied; serverDefs keeps the templates.
  serverDefs: z.array(ServerDefSchema).optional(),
  // Named component schemas / definitions (for the models browser), dereferenced + acyclic.
  schemas: z.array(z.object({ name: z.string(), schema: z.unknown() })).optional(),
});

export const ProxyRequestSchema = z.object({
  operationId: z.string(),
  server: z.string(),
  method: z.string(),
  path: z.string(),
  pathParams: z.record(z.string()).default({}),
  query: z.record(z.union([z.string(), z.array(z.string())])).default({}),
  headers: z.record(z.string()).default({}),
  body: z.unknown().optional(),
});

// Files can't ride inside the JSON ProxyRequest, so multipart uploads are sent as a real
// `multipart/form-data` request whose `__meta` part carries everything about the request
// except the body (which is reconstructed server-side from the remaining parts).
export const ProxyMultipartMetaSchema = ProxyRequestSchema.omit({ body: true });

export const ProxyResponseSchema = z.object({
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string()),
  body: z.unknown(),
  durationMs: z.number(),
  bodySize: z.number(),
});

export const ProxyErrorSchema = z.object({
  error: z.object({
    kind: z.enum(["timeout", "dns", "connection", "forbidden", "bad_request"]),
    message: z.string(),
  }),
});

// A request to exchange OAuth2 credentials for a token, proxied by the server (avoids browser
// CORS and keeps client secrets off the page). Covers client_credentials, password, and
// authorization_code (with optional PKCE code_verifier).
export const OAuthTokenRequestSchema = z.object({
  tokenUrl: z.string().url(),
  grantType: z.enum(["client_credentials", "password", "authorization_code"]),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scope: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  code: z.string().optional(),
  redirectUri: z.string().optional(),
  codeVerifier: z.string().optional(),
  // How to present client credentials: in the form body (client_secret_post) or a Basic
  // Authorization header (client_secret_basic).
  clientAuth: z.enum(["body", "basic"]).default("body"),
});

export type OAuthTokenRequest = z.infer<typeof OAuthTokenRequestSchema>;

export const SpecConfigSchema = z.object({
  name: z.string().min(1),
  // An HTTP(S) URL or a local file path to an OpenAPI/Swagger document. SwaggerParser resolves
  // both; a path lets you point at bundled test specs (see test-specs/) without a live server.
  url: z.string().min(1),
  defaultServer: z.string().url().nullable().default(null),
});

export const ConfigSchema = z.object({
  refreshIntervalMs: z.number().int().positive().default(300000),
  proxyTimeoutMs: z.number().int().positive().default(30000),
  specs: z.array(SpecConfigSchema).min(1),
});

export type Param = z.infer<typeof ParamSchema>;
export type Operation = z.infer<typeof OperationSchema>;
export type ResponseDef = z.infer<typeof ResponseDefSchema>;
export type ExternalDocs = z.infer<typeof ExternalDocsSchema>;
export type OAuthFlow = z.infer<typeof OAuthFlowSchema>;
export type SecurityScheme = z.infer<typeof SecuritySchemeSchema>;
export type SecurityRequirement = z.infer<typeof SecurityRequirementSchema>;
export type SpecStatus = z.infer<typeof SpecStatusSchema>;
export type SpecMeta = z.infer<typeof SpecMetaSchema>;
export type ServerDef = z.infer<typeof ServerDefSchema>;
export type ServerVariable = z.infer<typeof ServerVariableSchema>;
export type ProxyRequest = z.infer<typeof ProxyRequestSchema>;
export type ProxyMultipartMeta = z.infer<typeof ProxyMultipartMetaSchema>;
export type ProxyResponse = z.infer<typeof ProxyResponseSchema>;
export type ProxyError = z.infer<typeof ProxyErrorSchema>;
export type SpecConfig = z.infer<typeof SpecConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
