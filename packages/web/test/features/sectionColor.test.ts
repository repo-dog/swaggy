import { describe, it, expect } from "vitest";
import { sectionColor, sectionColors, SECTION_PALETTE_SIZE } from "../../src/features/operations/sectionColor.js";

describe("sectionColor", () => {
  it("is deterministic for the same name", () => {
    expect(sectionColor("Users")).toEqual(sectionColor("Users"));
  });

  it("returns valid header + border class strings (with light + dark variants)", () => {
    const c = sectionColor("Orders");
    expect(c.header).toMatch(/^bg-[a-z]+-\d+ text-[a-z]+-\d+ hover:bg-\S+ dark:/);
    expect(c.border).toMatch(/^border-[a-z]+-\d+ dark:border-\S+$/);
  });

  it("distributes different names across more than one color", () => {
    const names = ["Users", "Orders", "Payments", "Auth", "Billing", "Search", "Admin", "Inventory"];
    const distinct = new Set(names.map((n) => sectionColor(n).header));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("offers a wide palette (>= 20 colors)", () => {
    expect(SECTION_PALETTE_SIZE).toBeGreaterThanOrEqual(20);
  });

  it("never assigns the same color to adjacent sections", () => {
    // Names chosen to force at least one natural hash collision would still be split.
    const names = Array.from({ length: 40 }, (_, i) => `Section${i}`);
    const colors = sectionColors(names).map((c) => c.header);
    for (let i = 1; i < colors.length; i++) {
      expect(colors[i]).not.toBe(colors[i - 1]);
    }
  });

  it("keeps a name's color stable when its predecessor doesn't collide", () => {
    // sectionColors should match the bare hash color unless nudged by a neighbor.
    expect(sectionColors(["Users"])[0]).toEqual(sectionColor("Users"));
  });
});
