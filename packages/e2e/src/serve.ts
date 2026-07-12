import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildApp } from "../../server/src/app.js";
import { SpecRegistry } from "../../server/src/services/spec-registry.js";
import { fetchDereferencedSpec } from "../../server/src/services/fetch-spec.js";
import { startMockBackend, MOCK_PORT } from "./mock-backend.js";
import type { Config } from "@swaggy/shared";

// Boots the full e2e environment for Playwright: the mock backend plus a real Swaggy server
// (loaded with the kitchen-sink specs) serving the built web UI. Playwright's webServer runs
// this; it also builds the web bundle first so buildApp can serve it.
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 4598);
const here = dirname(fileURLToPath(import.meta.url));
const specPath = (f: string) => join(here, "..", "specs", f);

const config: Config = {
  refreshIntervalMs: 300000,
  proxyTimeoutMs: 10000,
  specs: [
    { name: "swagger-2.0", url: specPath("kitchen-sink-2.0.json"), defaultServer: null },
    { name: "openapi-3.0", url: specPath("kitchen-sink-3.0.json"), defaultServer: null },
    { name: "openapi-3.1", url: specPath("kitchen-sink-3.1.json"), defaultServer: null },
  ],
};
const logger = { info() {}, warn() {}, error() {}, debug() {}, fatal() {}, trace() {}, child: () => logger } as never;

const mock = await startMockBackend(MOCK_PORT);
const registry = new SpecRegistry(config, { fetchSpec: fetchDereferencedSpec, logger });
await registry.refreshAll();
const app = buildApp({ registry, proxyTimeoutMs: 10000, logger });
await app.listen({ port: APP_PORT, host: "127.0.0.1" });
// eslint-disable-next-line no-console
console.log(`[e2e] Swaggy on http://localhost:${APP_PORT} (mock backend on ${MOCK_PORT})`);

const shutdown = async () => {
  await app.close();
  await mock.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
