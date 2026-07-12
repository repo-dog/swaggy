import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SendBar } from "../../src/features/response/SendBar.js";
import { useStore } from "../../src/store/store.js";
import * as api from "../../src/lib/api.js";
import type { Operation } from "@swaggy/shared";

const op: Operation = {
  id: "users:getUser", specId: "users", specTitle: "Users", method: "GET", path: "/users/{id}",
  summary: "", description: "", tags: [], servers: ["https://a.com"],
  pathParams: [{ name: "id", in: "path", schema: {}, required: true }],
  queryParams: [], headerParams: [], requestBody: null, responses: [],
};

function renderBar(inputs: any) {
  const qc = new QueryClient();
  render(<QueryClientProvider client={qc}><SendBar op={op} inputs={inputs} /></QueryClientProvider>);
}

beforeEach(() => { localStorage.clear(); useStore.setState(useStore.getInitialState(), true); });

describe("SendBar", () => {
  it("blocks send and shows validation errors when required params missing", async () => {
    renderBar({ server: "https://a.com", pathParams: {}, query: {}, headers: {} });
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(screen.getByText(/Missing required path parameter: id/)).toBeInTheDocument();
  });

  it("sends, shows the response status, and records history on success", async () => {
    vi.spyOn(api, "sendProxy").mockResolvedValue({ ok: true, response: { status: 200, statusText: "", headers: {}, body: { id: "1" }, durationMs: 3, bodySize: 9 } });
    renderBar({ server: "https://a.com", pathParams: { id: "1" }, query: {}, headers: {} });
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(await screen.findByText(/200/)).toBeInTheDocument();
    const active = useStore.getState().profiles.find((p) => p.profileId === useStore.getState().activeProfileId)!;
    expect(active.history).toHaveLength(1);
  });

  it("renders this operation's saved response and ignores another operation's", () => {
    useStore.getState().setLastResponse("users:getUser", {
      kind: "result",
      result: { ok: true, response: { status: 201, statusText: "", headers: {}, body: {}, durationMs: 1, bodySize: 2 } },
    });
    useStore.getState().setLastResponse("other:op", {
      kind: "result",
      result: { ok: true, response: { status: 500, statusText: "", headers: {}, body: {}, durationMs: 1, bodySize: 2 } },
    });
    renderBar({ server: "https://a.com", pathParams: { id: "1" }, query: {}, headers: {} });
    expect(screen.getByText(/201/)).toBeInTheDocument();
    expect(screen.queryByText(/500/)).not.toBeInTheDocument();
    // Stats are labelled clearly.
    expect(screen.getByText(/Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Time/i)).toBeInTheDocument();
    expect(screen.getByText(/Size/i)).toBeInTheDocument();
  });

  it("offers Save as snapshot only after a request is made, and saves the inputs", async () => {
    vi.spyOn(api, "sendProxy").mockResolvedValue({ ok: true, response: { status: 200, statusText: "", headers: {}, body: {}, durationMs: 2, bodySize: 2 } });
    renderBar({ server: "https://a.com", pathParams: { id: "7" }, query: {}, headers: {} });

    // Not shown before any request has been sent.
    expect(screen.queryByRole("button", { name: /save as snapshot/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText(/200/);

    // Now available; expand it, name it, save.
    await userEvent.click(screen.getByRole("button", { name: /save as snapshot/i }));
    await userEvent.type(screen.getByLabelText(/snapshot name/i), "smoke test");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    const saved = useStore.getState().snapshotsByOperationId["users:getUser"][0];
    expect(saved.name).toBe("smoke test");
    expect(saved.inputs.pathParams.id).toBe("7");
  });

  it("records manually-added custom headers in history so they survive replay", async () => {
    vi.spyOn(api, "sendProxy").mockResolvedValue({ ok: true, response: { status: 200, statusText: "", headers: {}, body: {}, durationMs: 3, bodySize: 2 } });
    renderBar({ server: "https://a.com", pathParams: { id: "1" }, query: {}, headers: {}, customHeaders: [{ name: "X-Trace", value: "abc" }] });
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText(/200/);
    const active = useStore.getState().profiles.find((p) => p.profileId === useStore.getState().activeProfileId)!;
    expect(active.history![0].request.customHeaders).toEqual([{ name: "X-Trace", value: "abc" }]);
  });

  it("sends on cmd/ctrl+Enter", async () => {
    const spy = vi.spyOn(api, "sendProxy").mockResolvedValue({ ok: true, response: { status: 200, statusText: "", headers: {}, body: {}, durationMs: 2, bodySize: 2 } });
    renderBar({ server: "https://a.com", pathParams: { id: "1" }, query: {}, headers: {} });
    fireEvent.keyDown(window, { key: "Enter", metaKey: true });
    expect(await screen.findByText(/200/)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("warns about unresolved {{variables}} without blocking the form", () => {
    renderBar({ server: "https://a.com", pathParams: { id: "{{orderId}}" }, query: {}, headers: {} });
    expect(screen.getByText(/unresolved variable/i)).toBeInTheDocument();
    expect(screen.getByText(/\{\{orderId\}\}/)).toBeInTheDocument();
  });

  it("resolves a captured variable into the sent request", async () => {
    useStore.getState().setVariable("orderId", "99");
    const spy = vi.spyOn(api, "sendProxy").mockResolvedValue({ ok: true, response: { status: 200, statusText: "OK", headers: {}, body: {}, durationMs: 1, bodySize: 2 } });
    renderBar({ server: "https://a.com", pathParams: { id: "{{orderId}}" }, query: {}, headers: {} });
    expect(screen.queryByText(/unresolved variable/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByText(/200/);
    expect(spy.mock.calls[0][0].pathParams.id).toBe("99");
  });
});
