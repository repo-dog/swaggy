import { describe, it, expect } from "vitest";
import { timeAgo } from "../../src/features/history/timeAgo.js";

const base = 1_000_000_000_000;

describe("timeAgo", () => {
  it("formats seconds, minutes, hours and days", () => {
    expect(timeAgo(base, base + 5_000)).toBe("5s ago");
    expect(timeAgo(base, base + 3 * 60_000)).toBe("3m ago");
    expect(timeAgo(base, base + 2 * 3_600_000)).toBe("2h ago");
    expect(timeAgo(base, base + 4 * 86_400_000)).toBe("4d ago");
  });

  it("clamps future timestamps to 0s", () => {
    expect(timeAgo(base + 5_000, base)).toBe("0s ago");
  });
});
