import { describe, it, expect } from "vitest";
import { humanizeLabel } from "../../src/lib/humanize.js";

describe("humanizeLabel", () => {
  it("converts camelCase to sentence case", () => {
    expect(humanizeLabel("phoneNumber")).toBe("Phone number");
    expect(humanizeLabel("firstName")).toBe("First name");
    expect(humanizeLabel("userId")).toBe("User id");
  });

  it("converts snake_case to sentence case", () => {
    expect(humanizeLabel("user_id")).toBe("User id");
    expect(humanizeLabel("phone_number")).toBe("Phone number");
    expect(humanizeLabel("first_name")).toBe("First name");
  });

  it("handles mixed camelCase + underscores", () => {
    expect(humanizeLabel("myField_name")).toBe("My field name");
  });

  it("leaves plain lowercase words intact (capitalises first only)", () => {
    expect(humanizeLabel("email")).toBe("Email");
    expect(humanizeLabel("name")).toBe("Name");
  });

  it("returns the original string when empty", () => {
    expect(humanizeLabel("")).toBe("");
  });
});
