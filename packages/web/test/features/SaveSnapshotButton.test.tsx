import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveSnapshotButton } from "../../src/features/request/SaveSnapshotButton.js";
import { useStore } from "../../src/store/store.js";
import type { Operation } from "@swaggy/shared";
import type { RequestInputs } from "../../src/features/request/buildProxyRequest.js";

const op: Operation = {
  id: "users:getUser", specId: "users", specTitle: "Users", method: "GET", path: "/users/{id}",
  summary: "", description: "", tags: [], servers: ["https://a"],
  pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [],
};
const inputs: RequestInputs = { server: "https://a", pathParams: { id: "42" }, query: {}, headers: {} };

const snaps = () => useStore.getState().snapshotsByOperationId["users:getUser"] ?? [];

beforeEach(() => { localStorage.clear(); useStore.setState(useStore.getInitialState(), true); });

describe("SaveSnapshotButton", () => {
  it("saves a uniquely-named snapshot", async () => {
    render(<SaveSnapshotButton op={op} inputs={inputs} />);
    await userEvent.click(screen.getByRole("button", { name: /save as snapshot/i }));
    await userEvent.type(screen.getByLabelText(/snapshot name/i), "Prod run");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(snaps().map((s) => s.name)).toEqual(["Prod run"]);
  });

  it("blocks a duplicate snapshot name (case-insensitive) and disables Save", async () => {
    useStore.getState().addSnapshot("users:getUser", "Prod", inputs);
    render(<SaveSnapshotButton op={op} inputs={inputs} />);
    await userEvent.click(screen.getByRole("button", { name: /save as snapshot/i }));
    await userEvent.type(screen.getByLabelText(/snapshot name/i), "prod");

    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    const saveBtn = screen.getByRole("button", { name: "Save" });
    expect(saveBtn).toBeDisabled();
    await userEvent.click(saveBtn);
    // Nothing added — still just the original snapshot.
    expect(snaps()).toHaveLength(1);
  });
});
