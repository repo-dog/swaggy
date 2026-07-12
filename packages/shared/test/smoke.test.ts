import { describe, it, expect } from "vitest";
import { ConfigSchema } from "../src/index.js";

describe("shared package", () => {
  it("exports a working Zod contract (ConfigSchema parses + applies defaults)", () => {
    const cfg = ConfigSchema.parse({ specs: [{ name: "a", url: "https://x/o.json" }] });
    expect(cfg.refreshIntervalMs).toBe(300000);
    expect(cfg.specs[0].defaultServer).toBeNull();
  });
});
