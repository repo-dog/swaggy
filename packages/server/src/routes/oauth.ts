import type { FastifyInstance } from "fastify";
import { OAuthTokenRequestSchema } from "@swaggy/shared";
import type { SpecRegistry } from "../services/spec-registry.js";
import { requestOAuthToken } from "../services/oauth.js";

/** Server-side OAuth2 token exchange: the browser posts the grant details here and we call the
 * provider's token endpoint (avoids CORS and keeps client secrets off the page). The target is
 * restricted to token hosts declared by the loaded specs. */
export function registerOAuthRoute(app: FastifyInstance, registry: SpecRegistry, timeoutMs: number): void {
  app.post("/api/oauth/token", async (req, reply) => {
    const parsed = OAuthTokenRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { kind: "bad_request", message: parsed.error.message } });
    }
    const outcome = await requestOAuthToken(parsed.data, { timeoutMs, allowedHosts: registry.getOAuthTokenHosts() });
    if (outcome.ok) return reply.code(200).send(outcome.token);
    return reply.code(outcome.status).send({ error: outcome.error });
  });
}
