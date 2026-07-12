import { describe, it, expect } from "vitest";
import { normalizeSpec, resolveServers, normalizeSecuritySchemes, normalizeSchemas } from "../../src/services/normalizer.js";

const specUrl = "https://api.example.com/v3/openapi.json";

describe("resolveServers", () => {
  it("keeps absolute server URLs", () => {
    expect(resolveServers({ servers: [{ url: "https://a.com/v1" }] }, specUrl)).toEqual(["https://a.com/v1"]);
  });
  it("resolves relative servers against the spec origin", () => {
    expect(resolveServers({ servers: [{ url: "/v1" }] }, specUrl)).toEqual(["https://api.example.com/v1"]);
  });
  it("falls back to the OpenAPI 2.0 host + basePath + scheme when servers absent", () => {
    expect(
      resolveServers({ host: "api.example.com", basePath: "/v2", schemes: ["https"] }, specUrl),
    ).toEqual(["https://api.example.com/v2"]);
  });
  it("uses the spec URL protocol for host when schemes absent", () => {
    expect(resolveServers({ host: "h.com" }, "http://x/openapi.json")).toEqual(["http://h.com"]);
  });
  it("fills server-variable defaults so a templated server resolves", () => {
    expect(
      resolveServers(
        { servers: [{ url: "https://{host}.example.com/{basePath}", variables: { host: { default: "api", enum: ["api", "staging"] }, basePath: { default: "v2" } } }] },
        specUrl,
      ),
    ).toEqual(["https://api.example.com/v2"]);
  });
  it("falls back to the spec URL directory when no servers or host", () => {
    expect(resolveServers({}, specUrl)).toEqual(["https://api.example.com/v3"]);
    expect(resolveServers({ servers: [] }, specUrl)).toEqual(["https://api.example.com/v3"]);
  });
  it("uses defaultServer only when the spec URL is unusable", () => {
    expect(resolveServers({}, "not a url", "https://fallback.com")).toEqual(["https://fallback.com"]);
  });
  it("returns empty when nothing resolves", () => {
    expect(resolveServers({}, "not a url")).toEqual([]);
  });
});

describe("normalizeSecuritySchemes", () => {
  it("normalizes 3.x http, apiKey, and oauth2 schemes", () => {
    const schemes = normalizeSecuritySchemes({
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          apiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
          oauth2: { type: "oauth2", flows: { authorizationCode: { authorizationUrl: "https://a/auth", tokenUrl: "https://a/token", scopes: { read: "Read" } } } },
        },
      },
    });
    expect(schemes.find((s) => s.key === "bearerAuth")).toMatchObject({ type: "http", scheme: "bearer", bearerFormat: "JWT" });
    expect(schemes.find((s) => s.key === "apiKey")).toMatchObject({ type: "apiKey", in: "header", paramName: "X-API-Key" });
    expect(schemes.find((s) => s.key === "oauth2")!.flows!.authorizationCode).toMatchObject({ tokenUrl: "https://a/token" });
  });

  it("normalizes 2.0 basic and oauth2 (flow → flows) from securityDefinitions", () => {
    const schemes = normalizeSecuritySchemes({
      securityDefinitions: {
        basicAuth: { type: "basic" },
        oauth2: { type: "oauth2", flow: "accessCode", authorizationUrl: "https://a/auth", tokenUrl: "https://a/token", scopes: { write: "Write" } },
      },
    });
    expect(schemes.find((s) => s.key === "basicAuth")).toMatchObject({ type: "http", scheme: "basic" });
    // 2.0 "accessCode" maps to the 3.x "authorizationCode" flow name.
    expect(schemes.find((s) => s.key === "oauth2")!.flows!.authorizationCode).toMatchObject({ authorizationUrl: "https://a/auth", tokenUrl: "https://a/token" });
  });

  it("returns [] when no schemes are declared", () => {
    expect(normalizeSecuritySchemes({})).toEqual([]);
  });
});

describe("normalizeSchemas", () => {
  it("extracts 3.x component schemas", () => {
    const s = normalizeSchemas({ components: { schemas: { User: { type: "object" }, Order: { type: "object" } } } });
    expect(s?.map((x) => x.name)).toEqual(["User", "Order"]);
  });
  it("extracts 2.0 definitions and returns undefined when none", () => {
    expect(normalizeSchemas({ definitions: { Pet: { type: "object" } } })?.[0].name).toBe("Pet");
    expect(normalizeSchemas({})).toBeUndefined();
  });
});

describe("normalizeSpec", () => {
  const doc = {
    openapi: "3.0.0",
    info: { title: "Users API", version: "1.2.0" },
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/users/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        get: {
          operationId: "getUser",
          summary: "Get a user",
          tags: ["users"],
          parameters: [{ name: "verbose", in: "query", description: "Return extra fields", schema: { type: "boolean", default: false } }],
          responses: { "200": { content: { "application/json": { schema: { type: "object" } } } } },
        },
        post: {
          summary: "Replace a user",
          requestBody: { content: { "application/json": { schema: { type: "object", example: { name: "x" } } } } },
          responses: { "200": { description: "ok" } },
        },
      },
    },
  };

  it("produces one operation per method", () => {
    const spec = normalizeSpec(doc, "users", specUrl);
    expect(spec.operations).toHaveLength(2);
    expect(spec.title).toBe("Users API");
    expect(spec.version).toBe("1.2.0");
    expect(spec.serverUrls).toEqual(["https://api.example.com"]);
  });

  it("prefers the spec operationId for the stable id", () => {
    const spec = normalizeSpec(doc, "users", specUrl);
    const get = spec.operations.find((o) => o.method === "GET")!;
    expect(get.id).toBe("users:getUser");
  });

  it("falls back to method:path when operationId is absent", () => {
    const spec = normalizeSpec(doc, "users", specUrl);
    const post = spec.operations.find((o) => o.method === "POST")!;
    expect(post.id).toBe("users:POST:/users/{id}");
  });

  it("merges path-level params into each operation", () => {
    const spec = normalizeSpec(doc, "users", specUrl);
    const get = spec.operations.find((o) => o.method === "GET")!;
    expect(get.pathParams.map((p) => p.name)).toEqual(["id"]);
    expect(get.queryParams.map((p) => p.name)).toEqual(["verbose"]);
    expect(get.pathParams[0].required).toBe(true);
  });

  it("carries the param description through", () => {
    const spec = normalizeSpec(doc, "users", specUrl);
    const get = spec.operations.find((o) => o.method === "GET")!;
    expect(get.queryParams[0].description).toBe("Return extra fields");
  });

  it("extracts default from a query param schema", () => {
    const spec = normalizeSpec(doc, "users", specUrl);
    const get = spec.operations.find((o) => o.method === "GET")!;
    expect(get.queryParams[0].default).toBe(false);
  });

  it("picks the application/json request body and its example", () => {
    const spec = normalizeSpec(doc, "users", specUrl);
    const post = spec.operations.find((o) => o.method === "POST")!;
    expect(post.requestBody?.contentType).toBe("application/json");
    expect((post.requestBody?.jsonSchema as any).example).toEqual({ name: "x" });
  });

  it("captures response definitions", () => {
    const spec = normalizeSpec(doc, "users", specUrl);
    const get = spec.operations.find((o) => o.method === "GET")!;
    expect(get.responses[0].status).toBe("200");
    expect(get.responses[0].contentType).toBe("application/json");
  });

  it("captures response description, example, and deprecated / externalDocs metadata", () => {
    const metaDoc = {
      openapi: "3.0.3",
      info: { title: "Meta", version: "1" },
      servers: [{ url: "https://api.example.com" }],
      paths: {
        "/legacy": {
          get: {
            operationId: "legacy",
            deprecated: true,
            externalDocs: { url: "https://docs.example.com/legacy", description: "Migration guide" },
            responses: {
              "200": {
                description: "A user list",
                content: {
                  "application/json": {
                    schema: { type: "array", items: { type: "string" } },
                    examples: { sample: { value: ["a", "b"] } },
                  },
                },
              },
            },
          },
        },
      },
    };
    const op = normalizeSpec(metaDoc, "meta", specUrl).operations[0];
    expect(op.deprecated).toBe(true);
    expect(op.externalDocs).toEqual({ url: "https://docs.example.com/legacy", description: "Migration guide" });
    expect(op.responses[0].description).toBe("A user list");
    expect(op.responses[0].example).toEqual(["a", "b"]);
    expect((op.responses[0].jsonSchema as any).items).toEqual({ type: "string" });
  });

  it("disambiguates duplicate operationIds so ids stay unique", () => {
    const dup = {
      openapi: "3.0.3",
      info: { title: "D", version: "1" },
      servers: [{ url: "https://a" }],
      paths: {
        "/a": { get: { operationId: "dup", responses: { "200": { description: "ok" } } } },
        "/b": { get: { operationId: "dup", responses: { "200": { description: "ok" } } } },
      },
    };
    const ids = normalizeSpec(dup, "d", specUrl).operations.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    expect(ids).toContain("d:dup");
    expect(ids).toContain("d:GET:/b");
  });

  it("matches +json request/response media types, not just application/json", () => {
    const plusJson = {
      openapi: "3.0.3",
      info: { title: "J", version: "1" },
      servers: [{ url: "https://a" }],
      paths: {
        "/x": {
          post: {
            operationId: "x",
            requestBody: { content: { "application/vnd.api+json": { schema: { type: "object", properties: { a: { type: "string" } } } } } },
            responses: { "200": { content: { "application/hal+json": { schema: { type: "object" } } } } },
          },
        },
      },
    };
    const op = normalizeSpec(plusJson, "j", specUrl).operations[0];
    expect(op.requestBody?.contentType).toBe("application/vnd.api+json");
    expect((op.requestBody?.jsonSchema as any).properties.a).toEqual({ type: "string" });
    expect(op.responses[0].contentType).toBe("application/hal+json");
  });

  it("surfaces an OpenAPI 3.x multipart/form-data body with its schema", () => {
    const doc = {
      openapi: "3.0.3",
      info: { title: "U", version: "1" },
      servers: [{ url: "https://a" }],
      paths: {
        "/upload": {
          post: {
            operationId: "upload",
            requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } },
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };
    const op = normalizeSpec(doc, "u", specUrl).operations[0];
    expect(op.requestBody?.contentType).toBe("multipart/form-data");
    expect((op.requestBody?.jsonSchema as any).properties.file).toEqual({ type: "string", format: "binary" });
  });

  it("builds a form body from Swagger 2.0 formData params (file → binary)", () => {
    const v2 = {
      swagger: "2.0",
      info: { title: "U", version: "1" },
      host: "a.com",
      paths: {
        "/upload": {
          post: {
            operationId: "upload",
            consumes: ["multipart/form-data"],
            parameters: [
              { name: "file", in: "formData", type: "file", required: true },
              { name: "note", in: "formData", type: "string" },
            ],
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };
    const op = normalizeSpec(v2, "u", specUrl).operations[0];
    expect(op.requestBody?.contentType).toBe("multipart/form-data");
    const schema = op.requestBody?.jsonSchema as any;
    expect(schema.properties.file).toMatchObject({ type: "string", format: "binary" });
    expect(schema.properties.note).toMatchObject({ type: "string" });
    expect(schema.required).toEqual(["file"]);
  });

  it("captures a Swagger 2.0 response schema (schema directly on the response)", () => {
    const v2 = {
      swagger: "2.0",
      info: { title: "J", version: "1" },
      host: "h.com",
      paths: {
        "/x": {
          get: {
            operationId: "getX",
            responses: {
              "200": { description: "ok", schema: { type: "object", properties: { id: { type: "string" } } }, examples: { "application/json": { id: "1" } } },
            },
          },
        },
      },
    };
    const op = normalizeSpec(v2, "j", "https://h.com/v2/api-docs").operations[0];
    expect((op.responses[0].jsonSchema as any).properties.id).toEqual({ type: "string" });
    expect(op.responses[0].example).toEqual({ id: "1" });
  });

  it("captures spec-level info (description, contact, license) and externalDocs", () => {
    const infoDoc = {
      openapi: "3.0.3",
      info: {
        title: "Petstore",
        version: "1.4.0",
        description: "A sample API.",
        contact: { name: "API Team", email: "api@x.test" },
        license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
      },
      externalDocs: { url: "https://docs.x.test", description: "Full docs" },
      servers: [{ url: "https://api.x.test" }],
      paths: { "/ping": { get: { operationId: "ping", responses: { "200": { description: "ok" } } } } },
    };
    const spec = normalizeSpec(infoDoc, "petstore", specUrl);
    expect(spec.description).toBe("A sample API.");
    expect(spec.contact).toEqual({ name: "API Team", email: "api@x.test" });
    expect(spec.license).toEqual({ name: "MIT", url: "https://opensource.org/licenses/MIT" });
    expect(spec.externalDocs).toEqual({ url: "https://docs.x.test", description: "Full docs" });
  });

  it("leaves deprecated / externalDocs undefined when not declared", () => {
    const op = normalizeSpec(doc, "users", specUrl).operations.find((o) => o.method === "GET")!;
    expect(op.deprecated).toBeUndefined();
    expect(op.externalDocs).toBeUndefined();
  });

  it("resolves operation security, inheriting the global default and honoring [] overrides", () => {
    const secDoc = {
      openapi: "3.0.3",
      info: { title: "S", version: "1" },
      servers: [{ url: "https://a" }],
      security: [{ bearerAuth: [] }],
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
      paths: {
        "/a": { get: { operationId: "a", responses: { "200": { description: "ok" } } } },
        "/b": { get: { operationId: "b", security: [{ apiKey: ["read"] }], responses: { "200": { description: "ok" } } } },
        "/c": { get: { operationId: "c", security: [], responses: { "200": { description: "ok" } } } },
      },
    };
    const spec = normalizeSpec(secDoc, "s", specUrl);
    const byId = (id: string) => spec.operations.find((o) => o.id === `s:${id}`)!;
    expect(byId("a").security).toEqual([{ bearerAuth: [] }]); // inherits global
    expect(byId("b").security).toEqual([{ apiKey: ["read"] }]); // own overrides
    expect(byId("c").security).toEqual([]); // explicit no-auth
    expect(spec.securitySchemes?.map((s) => s.key)).toContain("bearerAuth");
  });

  it("captures a Swagger 2.0 body parameter as the request body", () => {
    const doc = {
      swagger: "2.0",
      info: { title: "Jarvis", version: "1" },
      host: "jarvis.service.consul",
      basePath: "/",
      consumes: ["application/json"],
      paths: {
        "/instalments": {
          post: {
            operationId: "createInstalment",
            parameters: [
              { name: "X-Token", in: "header", required: true, type: "string" },
              { name: "body", in: "body", required: true, schema: { type: "object", properties: { amount: { type: "integer" } } } },
            ],
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };
    const spec = normalizeSpec(doc, "jarvis", "https://jarvis.service.consul/v2/api-docs");
    const post = spec.operations[0];
    expect(post.requestBody?.contentType).toBe("application/json");
    expect((post.requestBody?.jsonSchema as any).properties.amount).toEqual({ type: "integer" });
    // the in:body param must NOT leak into the header/query/path field lists
    expect(post.headerParams.map((p) => p.name)).toEqual(["X-Token"]);
    expect(post.pathParams).toHaveLength(0);
    expect(post.queryParams).toHaveLength(0);
  });

  it("synthesizes a param schema from OpenAPI 2.0 param-level type/enum/default", () => {
    const doc = {
      swagger: "2.0",
      info: { title: "Jarvis", version: "1" },
      host: "jarvis.service.consul",
      paths: {
        "/things": {
          get: {
            operationId: "listThings",
            parameters: [
              { name: "active", in: "query", type: "boolean", default: false },
              { name: "sort", in: "query", type: "string", enum: ["asc", "desc"], default: "asc" },
              { name: "tags", in: "query", type: "array", items: { type: "string" } },
            ],
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };
    const spec = normalizeSpec(doc, "jarvis", "https://jarvis.service.consul/v2/api-docs");
    const get = spec.operations[0];
    const byName = (n: string) => get.queryParams.find((p) => p.name === n)!;
    // type is lifted into schema so the UI renders the right control...
    expect((byName("active").schema as any).type).toBe("boolean");
    expect((byName("sort").schema as any).enum).toEqual(["asc", "desc"]);
    expect((byName("tags").schema as any)).toMatchObject({ type: "array", items: { type: "string" } });
    // ...and defaults are captured for form pre-fill.
    expect(byName("active").default).toBe(false);
    expect(byName("sort").default).toBe("asc");
  });

  it("defaults 2.0 body content type to application/json when consumes is absent", () => {
    const doc = {
      swagger: "2.0",
      info: { title: "J", version: "1" },
      paths: {
        "/x": {
          post: {
            operationId: "createX",
            parameters: [{ name: "body", in: "body", schema: { type: "object" } }],
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };
    const spec = normalizeSpec(doc, "j", "https://h/v2/api-docs");
    expect(spec.operations[0].requestBody?.contentType).toBe("application/json");
  });

  it("makes a recursive (dereferenced, circular) schema serializable", () => {
    // Simulate what SwaggerParser.dereference produces for a self-referential model:
    // a Node whose array items point back at the same object (a real JS cycle).
    const node: any = { type: "object", properties: { value: { type: "string" } } };
    node.properties.children = { type: "array", items: node };
    const doc = {
      openapi: "3.0.1",
      info: { title: "Holmium", version: "1" },
      servers: [{ url: "https://holmium.service.consul" }],
      paths: {
        "/tree": {
          get: {
            operationId: "getTree",
            responses: { "200": { content: { "application/json": { schema: node } } } },
          },
          post: {
            operationId: "putTree",
            requestBody: { content: { "application/json": { schema: node } } },
            responses: { "200": { description: "ok" } },
          },
        },
      },
    };
    const spec = normalizeSpec(doc, "holmium", "https://holmium.service.consul/v3/api-docs");
    // The whole operation set must JSON-serialize (this is what the /api/operations route does).
    expect(() => JSON.stringify(spec.operations)).not.toThrow();
    const get = spec.operations.find((o) => o.method === "GET")!;
    const schema = get.responses[0].jsonSchema as any;
    // Top level is preserved; the recursive back-reference is cut to a finite stub.
    expect(schema.properties.value).toEqual({ type: "string" });
    expect(schema.properties.children.items).toEqual({ type: "object" });
  });

  it("operation-level param overrides path-level param with same name+in", () => {
    const docWithOverride = {
      openapi: "3.0.0",
      info: { title: "Items API", version: "1.0.0" },
      servers: [{ url: "https://api.example.com" }],
      paths: {
        "/items/{id}": {
          parameters: [{ name: "id", in: "path", schema: { type: "string" }, description: "path-level" }],
          get: {
            operationId: "getItem",
            parameters: [{ name: "id", in: "path", schema: { type: "integer" }, description: "op-level" }],
            responses: {},
          },
        },
      },
    };
    const spec = normalizeSpec(docWithOverride, "items", "https://api.example.com/openapi.json");
    const get = spec.operations[0];
    expect(get.pathParams).toHaveLength(1);
    expect((get.pathParams[0].schema as any).type).toBe("integer");
  });
});
