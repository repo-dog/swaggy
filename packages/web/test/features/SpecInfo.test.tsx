import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpecInfoCard } from "../../src/features/operations/SpecInfo.js";
import type { SpecMeta } from "@swaggy/shared";

const meta: SpecMeta = {
  specId: "petstore",
  title: "Petstore",
  version: "1.4.0",
  serverUrls: ["https://api.petstore.test/v1"],
  operationCount: 12,
  lastRefreshedAt: null,
  status: "ok",
  description: "A **sample** API.",
  contact: { name: "API Team", email: "api@petstore.test" },
  license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
  externalDocs: { url: "https://docs.petstore.test", description: "Full docs" },
};

describe("SpecInfoCard", () => {
  it("shows title, version, description (markdown), contact, license, and docs link", () => {
    render(<SpecInfoCard meta={meta} />);
    expect(screen.getByText("Petstore")).toBeInTheDocument();
    expect(screen.getByText("v1.4.0")).toBeInTheDocument();
    expect(screen.getByText("sample").tagName).toBe("STRONG");
    expect(screen.getByText(/API Team/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MIT" })).toHaveAttribute("href", "https://opensource.org/licenses/MIT");
    expect(screen.getByRole("link", { name: /Full docs/ })).toHaveAttribute("href", "https://docs.petstore.test");
  });
});
