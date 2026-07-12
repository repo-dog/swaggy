import type { Config, SpecMeta, Operation, SpecStatus } from "@swaggy/shared";
import { normalizeSpec, type NormalizedSpec } from "./normalizer.js";

type Logger = { info: (...a: any[]) => void; warn: (...a: any[]) => void; error: (...a: any[]) => void };

type Entry = {
  name: string;
  url: string;
  defaultServer: string | null;
  spec: NormalizedSpec | null;
  status: SpecStatus;
  lastRefreshedAt: string | null;
};

export class SpecRegistry {
  private entries: Entry[];
  private fetchSpec: (url: string) => Promise<any>;
  private logger: Logger;
  private now: () => Date;

  constructor(
    config: Config,
    deps: { fetchSpec: (url: string) => Promise<any>; logger: Logger; now?: () => Date },
  ) {
    this.fetchSpec = deps.fetchSpec;
    this.logger = deps.logger;
    this.now = deps.now ?? (() => new Date());
    this.entries = config.specs.map((s) => ({
      name: s.name,
      url: s.url,
      defaultServer: s.defaultServer ?? null,
      spec: null,
      status: "error",
      lastRefreshedAt: null,
    }));
  }

  async refreshAll(): Promise<void> {
    await Promise.all(this.entries.map((e) => this.refreshOne(e)));
  }

  private async refreshOne(entry: Entry): Promise<void> {
    try {
      const doc = await this.fetchSpec(entry.url);
      entry.spec = normalizeSpec(doc, entry.name, entry.url, entry.defaultServer);
      entry.status = "ok";
      entry.lastRefreshedAt = this.now().toISOString();
      this.logger.info({ spec: entry.name, ops: entry.spec.operations.length }, "spec loaded");
    } catch (err) {
      if (entry.spec) {
        entry.status = "stale";
        this.logger.warn({ spec: entry.name, err: (err as Error).message }, "spec refresh failed; keeping last-good");
      } else {
        entry.status = "error";
        this.logger.error({ spec: entry.name, err: (err as Error).message }, "spec failed to load");
      }
    }
  }

  getSpecs(): SpecMeta[] {
    return this.entries.map((e) => ({
      specId: e.name,
      title: e.spec?.title ?? e.name,
      version: e.spec?.version ?? "unknown",
      serverUrls: e.spec?.serverUrls ?? [],
      operationCount: e.spec?.operations.length ?? 0,
      lastRefreshedAt: e.lastRefreshedAt,
      status: e.status,
      description: e.spec?.description,
      contact: e.spec?.contact,
      license: e.spec?.license,
      externalDocs: e.spec?.externalDocs,
      securitySchemes: e.spec?.securitySchemes,
      serverDefs: e.spec?.serverDefs,
      schemas: e.spec?.schemas,
    }));
  }

  getOperations(specId?: string): Operation[] {
    return this.entries
      .filter((e) => (specId ? e.name === specId : true))
      .flatMap((e) => e.spec?.operations ?? []);
  }

  // Hosts the OAuth2 token exchange is allowed to reach, gathered from the token/refresh URLs
  // declared by loaded specs' oauth2 security schemes. Prevents /api/oauth/token being used as
  // an open relay / SSRF vector to arbitrary URLs.
  getOAuthTokenHosts(): Set<string> {
    const hosts = new Set<string>();
    for (const e of this.entries) {
      for (const scheme of e.spec?.securitySchemes ?? []) {
        if (scheme.type !== "oauth2" || !scheme.flows) continue;
        for (const flow of Object.values(scheme.flows)) {
          for (const url of [flow.tokenUrl, flow.refreshUrl]) {
            if (typeof url === "string") {
              try {
                hosts.add(new URL(url).host);
              } catch {
                /* ignore unparseable */
              }
            }
          }
        }
      }
    }
    return hosts;
  }

  getAllowedHosts(): Set<string> {
    const hosts = new Set<string>();
    for (const e of this.entries) {
      for (const url of e.spec?.serverUrls ?? []) {
        try {
          hosts.add(new URL(url).host);
        } catch {
          /* ignore unparseable */
        }
      }
    }
    return hosts;
  }
}
