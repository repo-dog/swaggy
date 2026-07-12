import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaOutline } from "../../src/features/request/SchemaOutline.js";

const schema = {
  type: "object",
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["active", "archived", "pending"], default: "active", description: "Lifecycle state." },
    age: { type: "integer", minimum: 0, maximum: 120 },
    address: {
      type: "object",
      required: ["country"],
      properties: { country: { type: "string" }, postcode: { type: "string" } },
    },
    tags: { type: "array", items: { type: "string" } },
  },
};

describe("SchemaOutline", () => {
  it("shows each field with its type, status, enum, default, and description", () => {
    render(<SchemaOutline schema={schema} />);
    expect(screen.getByText("status")).toBeInTheDocument();
    expect(screen.getByText("age")).toBeInTheDocument();
    // status is required; others optional.
    expect(screen.getAllByText("required").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("optional").length).toBeGreaterThanOrEqual(1);
    // Enum values, default, and constraints surface.
    expect(screen.getByText(/enum: active │ archived │ pending/)).toBeInTheDocument();
    expect(screen.getByText("= active")).toBeInTheDocument();
    expect(screen.getByText("min 0 · max 120")).toBeInTheDocument();
    expect(screen.getByText("Lifecycle state.")).toBeInTheDocument();
    // Array element type is shown compactly.
    expect(screen.getByText("array<string>")).toBeInTheDocument();
  });

  it("nests object properties and lets them collapse", async () => {
    render(<SchemaOutline schema={schema} />);
    // Nested object properties are visible by default.
    expect(screen.getByText("country")).toBeInTheDocument();
    expect(screen.getByText("postcode")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Collapse address"));
    expect(screen.queryByText("postcode")).not.toBeInTheDocument();
  });

  it("truncates long enums", () => {
    render(<SchemaOutline schema={{ type: "object", properties: { c: { type: "string", enum: ["a", "b", "c", "d", "e", "f", "g"] } } }} />);
    expect(screen.getByText(/… \+2 more/)).toBeInTheDocument();
  });

  it("renders a single field for a non-object root", () => {
    render(<SchemaOutline schema={{ type: "array", items: { type: "string" } }} />);
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByText("array<string>")).toBeInTheDocument();
  });

  it("shows a placeholder when there is no schema", () => {
    render(<SchemaOutline schema={undefined} />);
    expect(screen.getByText("No schema.")).toBeInTheDocument();
  });
});
