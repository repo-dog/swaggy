import type { FastifyInstance, FastifyRequest } from "fastify";
import { ProxyRequestSchema, ProxyMultipartMetaSchema } from "@swaggy/shared";
import type { SpecRegistry } from "../services/spec-registry.js";
import { executeProxy, executeMultipartProxy, type MultipartPart } from "../services/proxy.js";

const badRequest = (message: string) => ({ error: { kind: "bad_request" as const, message } });

export function registerProxyRoute(app: FastifyInstance, registry: SpecRegistry, timeoutMs: number): void {
  app.post("/api/proxy", async (req, reply) => {
    const parsed = ProxyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(badRequest(parsed.error.message));
    }
    const outcome = await executeProxy(parsed.data, {
      allowedHosts: registry.getAllowedHosts(),
      timeoutMs,
    });
    if (outcome.ok) return reply.code(200).send(outcome.value);
    return reply.code(outcome.status).send(outcome.error);
  });

  // Real multipart/form-data uploads (Option B): the client sends an actual multipart request
  // whose `__meta` part is the JSON ProxyRequest metadata and whose remaining parts (text
  // fields + files) are reassembled and forwarded upstream.
  app.post("/api/proxy/multipart", async (req: FastifyRequest, reply) => {
    if (typeof req.isMultipart !== "function" || !req.isMultipart()) {
      return reply.code(400).send(badRequest("Expected multipart/form-data"));
    }
    let metaRaw: string | undefined;
    const parts: MultipartPart[] = [];
    try {
      for await (const part of req.parts()) {
        if (part.type === "file") {
          parts.push({ name: part.fieldname, data: await part.toBuffer(), filename: part.filename || "file", contentType: part.mimetype });
        } else if (part.fieldname === "__meta") {
          metaRaw = String(part.value);
        } else {
          parts.push({ name: part.fieldname, data: Buffer.from(String(part.value)) });
        }
      }
    } catch (e) {
      // @fastify/multipart throws when a limit (file size / count) is exceeded.
      return reply.code(400).send(badRequest((e as Error).message));
    }
    if (metaRaw === undefined) return reply.code(400).send(badRequest("Missing __meta part"));
    let metaJson: unknown;
    try {
      metaJson = JSON.parse(metaRaw);
    } catch {
      return reply.code(400).send(badRequest("Invalid __meta JSON"));
    }
    const parsed = ProxyMultipartMetaSchema.safeParse(metaJson);
    if (!parsed.success) return reply.code(400).send(badRequest(parsed.error.message));
    const outcome = await executeMultipartProxy(parsed.data, parts, {
      allowedHosts: registry.getAllowedHosts(),
      timeoutMs,
    });
    if (outcome.ok) return reply.code(200).send(outcome.value);
    return reply.code(outcome.status).send(outcome.error);
  });
}
