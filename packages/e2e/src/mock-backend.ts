import Fastify, { type FastifyInstance } from "fastify";
import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";

/** The fixed port the kitchen-sink specs point their server URL at. Keeping it constant means
 * the specs are static files and the proxy's host allow-list resolves to this backend. */
export const MOCK_PORT = 4599;
export const MOCK_URL = `http://localhost:${MOCK_PORT}`;

/** Headers we echo back — the request-scoped ones tests assert on (auth, api key, content
 * type, and any X-* custom header). Hop-by-hop / noise headers are dropped. */
function echoHeaders(headers: Record<string, unknown>): Record<string, string> {
  const keep = /^(authorization|x-api-key|content-type|accept|x-.*)$/i;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) if (keep.test(k)) out[k] = String(v);
  return out;
}

/**
 * A self-contained mock upstream that the Swaggy proxy forwards to during e2e tests. Endpoints
 * are echo-style (httpbin-like): they reflect method, path, query, headers, and body so a test
 * can assert exactly what reached the "server". Never part of the shipped app.
 */
export async function startMockBackend(port: number = MOCK_PORT): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(formbody); // application/x-www-form-urlencoded → req.body object
  await app.register(multipart);

  const echo = (req: { method: string; url: string; query: unknown; headers: Record<string, unknown>; body?: unknown }) => ({
    method: req.method,
    path: req.url.split("?")[0],
    query: req.query,
    headers: echoHeaders(req.headers),
    body: req.body ?? null,
  });

  // Generic echo for the bulk of operations (any method).
  app.all("/anything", async (req) => echo(req));
  app.all("/anything/*", async (req) => echo(req));

  // Path-param echo.
  app.get<{ Params: { id: string } }>("/users/:id", async (req) => ({ id: req.params.id, query: req.query, headers: echoHeaders(req.headers) }));

  // Explicit JSON / urlencoded body echoes.
  app.post("/json", async (req) => ({ received: req.body }));
  app.put("/json", async (req) => ({ received: req.body }));
  app.post("/form", async (req) => ({ form: req.body }));

  // Multipart echo: report each field value and file metadata (name/filename/size/type).
  app.post("/upload", async (req, reply) => {
    if (!req.isMultipart()) return reply.code(400).send({ error: "not multipart" });
    const fields: Record<string, string> = {};
    const files: { field: string; filename: string; mimetype: string; size: number }[] = [];
    for await (const part of req.parts()) {
      if (part.type === "file") {
        const buf = await part.toBuffer();
        files.push({ field: part.fieldname, filename: part.filename, mimetype: part.mimetype, size: buf.length });
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }
    return { fields, files };
  });

  // Status passthrough and redirect.
  app.get<{ Params: { code: string } }>("/status/:code", async (req, reply) => reply.code(Number(req.params.code) || 200).send({ code: Number(req.params.code) }));
  app.get("/redirect", async (_req, reply) => reply.code(302).header("location", `${MOCK_URL}/anything`).send());

  // Content-type variety, so the response viewer's JSON-vs-raw handling is exercised.
  app.get<{ Params: { kind: string } }>("/content/:kind", async (req, reply) => {
    switch (req.params.kind) {
      case "json": return reply.type("application/json").send({ hello: "world" });
      case "problem": return reply.type("application/problem+json").send({ type: "about:blank", title: "Teapot", status: 418 });
      case "xml": return reply.type("application/xml").send("<note><to>you</to></note>");
      case "text": return reply.type("text/plain").send("plain text body");
      case "html": return reply.type("text/html").send("<h1>hi</h1>");
      case "empty": return reply.code(204).send();
      default: return reply.code(404).send({ error: "unknown kind" });
    }
  });

  // Security checks: 401 unless the expected credential is present.
  app.get("/secure/apikey", async (req, reply) => {
    const ok = req.headers["x-api-key"] === "secret-key" || (req.query as { api_key?: string }).api_key === "secret-key";
    return ok ? { authorized: true, via: "apiKey" } : reply.code(401).send({ error: "missing api key" });
  });
  app.get("/secure/bearer", async (req, reply) => {
    const ok = String(req.headers.authorization ?? "").startsWith("Bearer ");
    return ok ? { authorized: true, via: "bearer" } : reply.code(401).send({ error: "missing bearer token" });
  });
  app.get("/secure/basic", async (req, reply) => {
    const ok = String(req.headers.authorization ?? "").startsWith("Basic ");
    return ok ? { authorized: true, via: "basic" } : reply.code(401).send({ error: "missing basic auth" });
  });

  // OAuth2 token endpoint for all grant types (client_credentials / password / auth code).
  app.post("/oauth/token", async (req) => {
    const grant = (req.body as { grant_type?: string })?.grant_type ?? "unknown";
    return { access_token: `test-token-${grant}`, token_type: "Bearer", expires_in: 3600, scope: "read write" };
  });

  await app.listen({ port, host: "127.0.0.1" });
  return app;
}
