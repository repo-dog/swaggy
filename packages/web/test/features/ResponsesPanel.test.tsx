import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResponsesPanel } from "../../src/features/response/ResponsesPanel.js";
import type { ResponseDef } from "@swaggy/shared";

const responses: ResponseDef[] = [
  { status: "200", contentType: "application/json", jsonSchema: { type: "object", properties: { id: { type: "string" } } }, description: "OK", example: { id: "1" } },
  { status: "404", contentType: null, jsonSchema: null, description: "Not found" },
];

describe("ResponsesPanel", () => {
  it("renders nothing when there are no responses", () => {
    const { container } = render(<ResponsesPanel responses={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists documented status codes and, when expanded, the schema and example", async () => {
    render(<ResponsesPanel responses={responses} />);
    // Top-level disclosure is collapsed; expand it.
    await userEvent.click(screen.getByText(/Responses \(2\)/));
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
    // Expand the 200 row to reveal its schema (field name) + example.
    await userEvent.click(screen.getByText("200"));
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText(/"id": "1"/)).toBeInTheDocument();
  });
});
