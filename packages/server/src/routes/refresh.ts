import type { FastifyInstance } from "fastify";
import type { SpecRegistry } from "../services/spec-registry.js";

export function registerRefreshRoute(app: FastifyInstance, registry: SpecRegistry): void {
  app.post("/api/refresh", async () => {
    await registry.refreshAll();
    return { refreshed: true };
  });
}
