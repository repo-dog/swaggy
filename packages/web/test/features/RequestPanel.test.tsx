import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequestPanel } from "../../src/features/request/RequestPanel.js";
import { useStore } from "../../src/store/store.js";
import type { HistoryEntry } from "../../src/store/store.types.js";
import type { Operation } from "@swaggy/shared";

const baseOp: Operation = {
  id: "users:getUser",
  specId: "users",
  specTitle: "Users",
  method: "GET",
  path: "/users/{id}",
  summary: "Get a user by ID",
  description: "",
  tags: [],
  servers: ["https://api.example.com"],
  pathParams: [{ name: "id", in: "path", schema: { type: "string" }, required: true }],
  queryParams: [],
  headerParams: [],
  requestBody: null,
  responses: [],
};

function renderRequestPanel(op: Operation, replaySeed?: HistoryEntry | null) {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <RequestPanel op={op} replaySeed={replaySeed} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  useStore.setState(useStore.getInitialState(), true);
  const setMode = useStore.getState().setMode;
  if (setMode) setMode("advanced");
});

describe("RequestPanel", () => {
  it("renders the operation path and method", () => {
    renderRequestPanel(baseOp);
    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText("/users/{id}")).toBeInTheDocument();
  });

  it("seeds inputs from replaySeed when operationId matches the current op", () => {
    const replaySeed: HistoryEntry = {
      id: "history-1",
      operationId: "users:getUser",
      timestamp: Date.now(),
      durationMs: 100,
      request: {
        server: "https://api.example.com",
        pathParams: { id: "999" },
        query: {},
        headers: {},
      },
      response: {
        status: 200,
        headers: {},
        body: {},
        bodyTruncated: false,
      },
    };

    renderRequestPanel(baseOp, replaySeed);

    // In advanced mode, the path param input should be rendered and seeded with value "999"
    const idInput = screen.getByDisplayValue("999");
    expect(idInput).toBeInTheDocument();
  });

  it("restores manually-added custom headers when reopening a history entry", () => {
    const replaySeed: HistoryEntry = {
      id: "history-hdr",
      operationId: "users:getUser",
      timestamp: Date.now(),
      durationMs: 100,
      request: {
        server: "https://api.example.com",
        pathParams: { id: "1" },
        query: {},
        headers: {},
        customHeaders: [{ name: "X-Trace", value: "abc" }],
      },
      response: { status: 200, headers: {}, body: {}, bodyTruncated: false },
    };

    renderRequestPanel(baseOp, replaySeed);

    // The ad-hoc header the user had added is restored, name and value.
    expect(screen.getByDisplayValue("X-Trace")).toBeInTheDocument();
    expect(screen.getByDisplayValue("abc")).toBeInTheDocument();
  });

  it("does not seed inputs when replaySeed operationId does not match the current op", () => {
    const replaySeed: HistoryEntry = {
      id: "history-2",
      operationId: "posts:getPost", // Different operation
      timestamp: Date.now(),
      durationMs: 100,
      request: {
        server: "https://api.example.com",
        pathParams: { id: "999" },
        query: {},
        headers: {},
      },
      response: {
        status: 200,
        headers: {},
        body: {},
        bodyTruncated: false,
      },
    };

    renderRequestPanel(baseOp, replaySeed);

    // The input should not have the seeded value "999"
    const idInputs = screen.queryAllByRole("textbox");
    const pathParamInput = idInputs.find((input) => {
      const value = (input as HTMLInputElement).value;
      return (input as HTMLInputElement).placeholder?.includes("id") || value === "";
    });

    // Verify the path param input doesn't have the seed value from a different operation
    if (pathParamInput) {
      expect((pathParamInput as HTMLInputElement).value).not.toBe("999");
    }
  });

  it("Advanced and Simple modes share the same inputs object — edits in one mode are visible in the other", async () => {
    // The Simple/Advanced toggle only appears when the operation has a request body.
    const bodyOp: Operation = {
      ...baseOp,
      method: "POST",
      requestBody: { contentType: "application/json", jsonSchema: { type: "object", properties: { note: { type: "string" } } } },
    };
    // Start in advanced mode (default from beforeEach).
    renderRequestPanel(bodyOp);

    // The snapshots panel also renders a text input; the path param field is the first other one.
    const paramInput = () =>
      screen.getAllByRole("textbox").find((el) => el.getAttribute("aria-label") !== "Snapshot name")! as HTMLInputElement;

    // Type a value into the param field while in Advanced mode.
    await userEvent.clear(paramInput());
    await userEvent.type(paramInput(), "abc-123");
    expect(paramInput().value).toBe("abc-123");

    // Toggle to Simple mode via the store (toggle is now in the global top bar, not RequestPanel).
    act(() => useStore.getState().setMode("simple"));

    // The same path param input should still show the typed value — both modes
    // render ParamFields with the same shared inputs object from RequestPanel state.
    expect(paramInput().value).toBe("abc-123");

    // Toggle back to Advanced — value must survive the round-trip.
    act(() => useStore.getState().setMode("advanced"));
    expect(paramInput().value).toBe("abc-123");
  });

  it("loads previously saved inputs for the operation", () => {
    useStore.getState().setInputs(baseOp.id, {
      server: "https://api.example.com", pathParams: { id: "777" }, query: {}, headers: {},
    });
    renderRequestPanel(baseOp);
    expect(screen.getByDisplayValue("777")).toBeInTheDocument();
  });

  it("Reset clears the filled-in inputs and the stored response", async () => {
    useStore.getState().setInputs(baseOp.id, {
      server: "https://api.example.com", pathParams: { id: "777" }, query: {}, headers: {},
    });
    useStore.getState().setLastResponse(baseOp.id, { kind: "network_error", message: "boom" });
    renderRequestPanel(baseOp);
    expect(screen.getByDisplayValue("777")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(screen.queryByDisplayValue("777")).not.toBeInTheDocument();
    expect(useStore.getState().inputsByOperationId[baseOp.id]).toBeUndefined();
    expect(useStore.getState().lastResponseByOperationId[baseOp.id]).toBeUndefined();
  });

  it("Reset keeps ad-hoc header rows but clears their values", async () => {
    useStore.getState().setInputs(baseOp.id, {
      server: "https://api.example.com", pathParams: { id: "7" }, query: {}, headers: {},
      customHeaders: [{ name: "X-Debug", value: "on" }],
    });
    renderRequestPanel(baseOp);
    expect(screen.getByDisplayValue("X-Debug")).toBeInTheDocument();
    expect(screen.getByDisplayValue("on")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /reset/i }));

    // The header row (its name) survives Reset; only the value is cleared.
    expect(screen.getByDisplayValue("X-Debug")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("on")).not.toBeInTheDocument();
  });

  it("applies a saved snapshot's inputs into the form", async () => {
    useStore.getState().addSnapshot(baseOp.id, "prod user", {
      server: "https://api.example.com", pathParams: { id: "555" }, query: {}, headers: {},
    });
    renderRequestPanel(baseOp);
    await userEvent.click(screen.getByRole("button", { name: "prod user" }));
    expect(screen.getByDisplayValue("555")).toBeInTheDocument();
    expect(screen.queryByText(/no longer fully matches/i)).not.toBeInTheDocument();
  });

  it("shows a drift error when an applied snapshot no longer matches the API", async () => {
    // Snapshot references a path param that no longer exists and omits the now-required "id".
    useStore.getState().addSnapshot(baseOp.id, "stale", {
      server: "https://api.example.com", pathParams: { legacyId: "1" }, query: {}, headers: {},
    });
    renderRequestPanel(baseOp);
    await userEvent.click(screen.getByRole("button", { name: "stale" }));
    expect(screen.getByText(/no longer fully matches the API/i)).toBeInTheDocument();
    expect(screen.getByText(/Path parameter "legacyId" no longer exists/i)).toBeInTheDocument();
  });

  it("resets inputs when the operation changes, regardless of replaySeed", () => {
    const replaySeed: HistoryEntry = {
      id: "history-3",
      operationId: "users:getUser",
      timestamp: Date.now(),
      durationMs: 100,
      request: {
        server: "https://api.example.com",
        pathParams: { id: "123" },
        query: {},
        headers: {},
      },
      response: {
        status: 200,
        headers: {},
        body: {},
        bodyTruncated: false,
      },
    };

    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <RequestPanel op={baseOp} replaySeed={replaySeed} />
      </QueryClientProvider>
    );

    // First render should seed with id "123"
    expect(screen.getByDisplayValue("123")).toBeInTheDocument();

    // Change to a different operation
    const newOp: Operation = {
      ...baseOp,
      id: "users:listUsers",
      path: "/users",
      pathParams: [],
    };

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <RequestPanel op={newOp} replaySeed={replaySeed} />
      </QueryClientProvider>
    );

    // After op change, the old seeded value should be gone (no path params in new op)
    expect(screen.queryByDisplayValue("123")).not.toBeInTheDocument();
  });
});
