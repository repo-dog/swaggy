import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ModelsBrowser } from "../../src/features/operations/ModelsBrowser.js";

function renderWithSpecs(specs: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["specs"], specs);
  return render(
    <QueryClientProvider client={qc}>
      <ModelsBrowser specId="s" onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

const specs = [
  { specId: "s", schemas: [
    { name: "User", schema: { type: "object", properties: { id: { type: "string" } } } },
    { name: "Order", schema: { type: "object", properties: { total: { type: "number" } } } },
  ] },
];

describe("ModelsBrowser", () => {
  it("lists models, filters them, and expands one to its schema outline", async () => {
    renderWithSpecs(specs);
    expect(screen.getByText("Models (2)")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Order")).toBeInTheDocument();
    // Expand User → SchemaOutline renders its field.
    await userEvent.click(screen.getByText("User"));
    expect(screen.getByText("id")).toBeInTheDocument();
    // Filter.
    await userEvent.type(screen.getByLabelText("Filter models"), "ord");
    expect(screen.queryByText("User")).not.toBeInTheDocument();
    expect(screen.getByText("Order")).toBeInTheDocument();
  });

  it("shows an empty message when the spec has no schemas", () => {
    renderWithSpecs([{ specId: "s", schemas: [] }]);
    expect(screen.getByText(/no component schemas/i)).toBeInTheDocument();
  });
});
