import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config/loader.js";

function write(obj: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "swaggy-"));
  const p = join(dir, "specs.config.json");
  writeFileSync(p, JSON.stringify(obj));
  return p;
}

describe("loadConfig", () => {
  it("loads a valid config with defaults", () => {
    const cfg = loadConfig(write({ specs: [{ name: "a", url: "https://x/o.json" }] }));
    expect(cfg.refreshIntervalMs).toBe(300000);
    expect(cfg.specs).toHaveLength(1);
  });

  it("throws on duplicate spec names", () => {
    const p = write({ specs: [{ name: "a", url: "https://x/1.json" }, { name: "a", url: "https://x/2.json" }] });
    expect(() => loadConfig(p)).toThrow(/duplicate spec name/i);
  });

  it("throws a readable error on invalid config", () => {
    const p = write({ specs: [] });
    expect(() => loadConfig(p)).toThrow(/config/i);
  });

  it("throws when the file is missing", () => {
    expect(() => loadConfig("/no/such/file.json")).toThrow();
  });
});
