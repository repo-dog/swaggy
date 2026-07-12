import { describe, it, expect } from "vitest";
import { resolveConfigPath } from "../../src/config/resolve-config-path.js";

describe("resolveConfigPath", () => {
  it("returns envPath unchanged when set (fileExists never consulted)", () => {
    const mockFileExists = () => {
      throw new Error("fileExists should not be called");
    };
    const result = resolveConfigPath("/some/dir", "/explicit/path/config.json", mockFileExists);
    expect(result).toBe("/explicit/path/config.json");
  });

  it("finds config in startDir and returns that join", () => {
    const fileExists = (p: string) => p === "/start/dir/specs.config.json";
    const result = resolveConfigPath("/start/dir", undefined, fileExists);
    expect(result).toBe("/start/dir/specs.config.json");
  });

  it("finds config two levels up and returns ancestor path", () => {
    const fileExists = (p: string) => p === "/ancestor/specs.config.json";
    const result = resolveConfigPath("/ancestor/child/grandchild", undefined, fileExists);
    expect(result).toBe("/ancestor/specs.config.json");
  });

  it("returns default 'specs.config.json' when not found anywhere", () => {
    const fileExists = () => false;
    const result = resolveConfigPath("/start/dir", undefined, fileExists);
    expect(result).toBe("specs.config.json");
  });
});
