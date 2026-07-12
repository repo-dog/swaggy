import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../../src/App.js";
import { useStore } from "../../src/store/store.js";
import * as api from "../../src/lib/api.js";

beforeEach(() => {
  localStorage.clear();
  useStore.setState(useStore.getInitialState(), true);
  vi.clearAllMocks();
  vi.spyOn(api, "getOperations").mockResolvedValue([]);
  vi.spyOn(api, "getSpecs").mockResolvedValue([]);
});

describe("side panels in the empty state", () => {
  it("keeps the right panel mounted with no operation selected, prompting to pick an API for snapshots", () => {
    render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>);
    // Empty state is shown…
    expect(screen.getByText(/no operation selected/i)).toBeInTheDocument();
    // …but the right panel is still there, with the op-scoped snapshots card prompting a selection.
    expect(screen.getByText(/select an api to see its snapshots/i)).toBeInTheDocument();
  });
});
