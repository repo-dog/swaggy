import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HistoryPanel } from "../../src/features/history/HistoryPanel.js";
import { useStore } from "../../src/store/store.js";
import * as api from "../../src/lib/api.js";
import type { Operation } from "@swaggy/shared";

const ops: Operation[] = [
  { id: "users:getUser", specId: "users", specTitle: "Users", method: "GET", path: "/users/{id}", summary: "Get a user", description: "", tags: ["Users"], servers: ["https://a"], pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [] },
];

function renderPanel(onReplay = vi.fn()) {
  vi.spyOn(api, "getOperations").mockResolvedValue(ops);
  const qc = new QueryClient();
  render(<QueryClientProvider client={qc}><HistoryPanel onReplay={onReplay} /></QueryClientProvider>);
  return onReplay;
}

beforeEach(() => { localStorage.clear(); useStore.setState(useStore.getInitialState(), true); vi.clearAllMocks(); });

describe("HistoryPanel", () => {
  it("shows method, path and status (not the description), and replays the entry on click", async () => {
    useStore.getState().addHistory({
      operationId: "users:getUser", durationMs: 4,
      request: { server: "https://a", pathParams: { id: "9" }, query: {}, headers: {} },
      response: { status: 200, headers: {}, body: {}, bodyTruncated: false },
    });
    const onReplay = renderPanel();
    expect(await screen.findByText("/users/{id}")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    // The API description/summary is intentionally not shown in the compact row.
    expect(screen.queryByText("Get a user")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("/users/{id}"));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onReplay.mock.calls[0][0].operationId).toBe("users:getUser");
  });

  it("falls back to the operationId when the operation is no longer known", async () => {
    useStore.getState().addHistory({
      operationId: "gone:op", durationMs: 4,
      request: { server: "https://a", pathParams: {}, query: {}, headers: {} },
      response: { status: 404, headers: {}, body: {}, bodyTruncated: false },
    });
    renderPanel();
    expect(await screen.findByText("gone:op")).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
  });
});
