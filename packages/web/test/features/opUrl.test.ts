import { describe, it, expect } from "vitest";
import { readOpFromSearch, writeOpToSearch } from "../../src/features/navigation/opUrl.js";

describe("opUrl", () => {
  it("reads the op param, or null when absent", () => {
    expect(readOpFromSearch("?op=users%3AgetUser")).toBe("users:getUser");
    expect(readOpFromSearch("")).toBeNull();
    expect(readOpFromSearch("?foo=1")).toBeNull();
  });

  it("writes (and url-encodes) the op param", () => {
    expect(writeOpToSearch("", "users:getUser")).toBe("?op=users%3AgetUser");
    // Round-trips back to the original id.
    expect(readOpFromSearch(writeOpToSearch("", "jarvis:POST:/user"))).toBe("jarvis:POST:/user");
  });

  it("removes the op param when null and preserves other params", () => {
    expect(writeOpToSearch("?op=x&keep=1", null)).toBe("?keep=1");
    expect(writeOpToSearch("?op=x", null)).toBe("");
  });
});
