import pino from "pino";
import { loadConfig } from "./config/loader.js";
import { resolveConfigPath } from "./config/resolve-config-path.js";
import { SpecRegistry } from "./services/spec-registry.js";
import { fetchDereferencedSpec } from "./services/fetch-spec.js";
import { buildApp } from "./app.js";

export async function main(): Promise<void> {
  const configPath = resolveConfigPath(process.cwd(), process.env.SWAGGY_CONFIG);
  const config = loadConfig(configPath);
  const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
  const registry = new SpecRegistry(config, { fetchSpec: fetchDereferencedSpec, logger });
  const app = buildApp({ registry, proxyTimeoutMs: config.proxyTimeoutMs, logger });

  await registry.refreshAll();
  setInterval(() => {
    registry.refreshAll().catch((e) => logger.error({ err: (e as Error).message }, "scheduled refresh failed"));
  }, config.refreshIntervalMs).unref();

  const port = Number(process.env.PORT ?? 8080);
  await app.listen({ port, host: "0.0.0.0" });
  logger.info({ port, specs: config.specs.length }, "swaggy backend listening");
}

main().catch((e) => {
  console.error(`Fatal: ${(e as Error).message}`);
  process.exit(1);
});
