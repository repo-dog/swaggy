import Fastify, { type FastifyInstance } from "fastify";
import type { Logger } from "pino";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { SpecRegistry } from "./services/spec-registry.js";
import { registerSpecRoutes } from "./routes/specs.js";
import { registerProxyRoute } from "./routes/proxy.js";
import { registerRefreshRoute } from "./routes/refresh.js";
import { registerOAuthRoute } from "./routes/oauth.js";

export function buildApp(deps: { registry: SpecRegistry; proxyTimeoutMs?: number; logger?: Logger }): FastifyInstance {
  // Reuse the caller's pino instance (shared with the registry) when given; otherwise stand up
  // a default one so tests / standalone use still log.
  const app = Fastify({ logger: deps.logger ?? { level: process.env.LOG_LEVEL ?? "info" } });

  // multipart/form-data parsing for the file-upload proxy route. Cap file size to match the
  // proxy's response read cap; the boundary/limit errors surface as 400s in the route.
  app.register(fastifyMultipart, { limits: { fileSize: 25 * 1024 * 1024, files: 100 } });

  // Liveness/readiness probe (used by the Docker HEALTHCHECK and orchestrators).
  app.get("/api/health", async () => ({ status: "ok", specs: deps.registry.getSpecs().length }));

  registerSpecRoutes(app, deps.registry);
  registerProxyRoute(app, deps.registry, deps.proxyTimeoutMs ?? 30000);
  registerRefreshRoute(app, deps.registry);
  registerOAuthRoute(app, deps.registry, deps.proxyTimeoutMs ?? 30000);

  const webDist = join(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
  if (existsSync(webDist)) {
    app.register(fastifyStatic, { root: webDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.code(404).send({ error: { kind: "bad_request", message: "Not found" } });
      return reply.sendFile("index.html");
    });
  }

  return app;
}
