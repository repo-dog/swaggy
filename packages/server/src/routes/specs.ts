import type { FastifyInstance } from "fastify";
import type { SpecRegistry } from "../services/spec-registry.js";

export function registerSpecRoutes(app: FastifyInstance, registry: SpecRegistry): void {
  app.get("/api/specs", async () => registry.getSpecs());

  app.get<{ Querystring: { specId?: string } }>("/api/operations", async (req) =>
    registry.getOperations(req.query.specId),
  );
}
