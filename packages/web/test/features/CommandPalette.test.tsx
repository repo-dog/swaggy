import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandPalette } from "../../src/features/palette/CommandPalette.js";
import { useStore } from "../../src/store/store.js";
import * as api from "../../src/lib/api.js";
import type { Operation } from "@swaggy/shared";

const ops: Operation[] = [
  { id: "users:getUser", specId: "users", specTitle: "Users", method: "GET", path: "/users/{id}", summary: "Get a user", description: "", tags: ["Users"], servers: ["https://a"], pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [] },
  { id: "orders:createOrder", specId: "orders", specTitle: "Orders", method: "POST", path: "/orders", summary: "Create order", description: "", tags: ["Orders"], servers: ["https://b"], pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [] },
];

function renderPalette(onSelect = vi.fn()) {
  vi.spyOn(api, "getOperations").mockResolvedValue(ops);
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <CommandPalette open onOpenChange={vi.fn()} onSelect={onSelect} />
    </QueryClientProvider>,
  );
  return onSelect;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useStore.setState(useStore.getInitialState(), true);
});

describe("CommandPalette", () => {
  it("filters operations as you type and highlights the match", async () => {
    renderPalette();
    const input = await screen.findByPlaceholderText(/search operations/i);
    await userEvent.type(input, "orders");
    // matched substring is wrapped in a <mark>
    const mark = await screen.findByText("orders", { selector: "mark" });
    expect(mark.tagName).toBe("MARK");
    // the non-matching operation is filtered out
    expect(screen.queryByText("/users/{id}")).not.toBeInTheDocument();
  });

  it("lists the most frequently selected operation first when the query is empty", async () => {
    // orders was opened once, users never — orders should rank first.
    useStore.getState().setSelectedOperation("orders:createOrder");
    renderPalette();
    const options = await screen.findAllByRole("option");
    expect(options[0].textContent).toContain("/orders");
  });

  it("gives the results list scroll-padding so the top row isn't clipped under the input", async () => {
    renderPalette();
    const list = await screen.findByRole("listbox");
    expect(list).toHaveClass("scroll-py-2");
  });

  it("snaps the results list back to the top when the query changes", async () => {
    renderPalette();
    const list = await screen.findByRole("listbox");
    const input = screen.getByPlaceholderText(/search operations/i);
    // Simulate a stale scroll position left over from prior interaction.
    list.scrollTop = 120;
    await userEvent.type(input, "o");
    // The list is re-homed so the top (best-match) row can't hide under the input.
    expect(list.scrollTop).toBe(0);
  });

  it("calls onSelect with the operation id when a result is chosen", async () => {
    const onSelect = renderPalette();
    const input = await screen.findByPlaceholderText(/search operations/i);
    await userEvent.type(input, "orders");
    // Fuse narrows to a single result; select it. fireEvent bypasses the
    // Radix dialog's pointer-events:none scroll lock that blocks userEvent.
    const option = await screen.findByRole("option");
    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith("orders:createOrder");
  });
});
