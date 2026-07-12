import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchDereferencedSpec } from "../../src/services/fetch-spec.js";
import { normalizeSpec } from "../../src/services/normalizer.js";
import { loadConfig } from "../../src/config/loader.js";

// Repo root is four levels up from packages/server/test/specs.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const specs = ["swagger-2.0", "openapi-3.0", "openapi-3.1", "edge-cases-3.0"];

describe("bundled test specs", () => {
  for (const name of specs) {
    it(`${name}.json parses and normalizes to operations`, async () => {
      const path = join(repoRoot, "test-specs", `${name}.json`);
      const deref = await fetchDereferencedSpec(path);
      const normalized = normalizeSpec(deref, name, path, null);
      expect(normalized.operations.length).toBeGreaterThan(0);
      // Every operation has an id, method, and path — the minimum the UI needs.
      for (const op of normalized.operations) {
        expect(op.id).toBeTruthy();
        expect(op.method).toBeTruthy();
        expect(op.path).toBeTruthy();
      }
    });
  }

  it("specs.config.test.json is a valid config with local file paths", () => {
    const cfg = loadConfig(join(repoRoot, "specs.config.test.json"));
    expect(cfg.specs).toHaveLength(4);
    expect(cfg.specs.every((s) => s.url.startsWith("./test-specs/"))).toBe(true);
  });
});
