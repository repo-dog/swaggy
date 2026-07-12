import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnapshotsPanel } from "../../src/features/request/SnapshotsPanel.js";
import { useStore } from "../../src/store/store.js";
import type { Operation } from "@swaggy/shared";
import type { RequestInputs } from "../../src/features/request/buildProxyRequest.js";

const op: Operation = {
  id: "users:getUser", specId: "users", specTitle: "Users", method: "GET", path: "/users/{id}",
  summary: "", description: "", tags: [], servers: ["https://a"],
  pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [],
};
const inputs: RequestInputs = { server: "https://a", pathParams: { id: "42" }, query: {}, headers: {} };

beforeEach(() => { localStorage.clear(); useStore.setState(useStore.getInitialState(), true); });

describe("SnapshotsPanel", () => {
  it("shows an empty hint when there are no snapshots", () => {
    render(<SnapshotsPanel op={op} onApply={vi.fn()} />);
    expect(screen.getByText(/no snapshots yet/i)).toBeInTheDocument();
  });

  it("prompts to select an API when no operation is selected", () => {
    render(<SnapshotsPanel op={null} onApply={vi.fn()} />);
    expect(screen.getByText(/select an api to see its snapshots/i)).toBeInTheDocument();
  });

  it("applies a snapshot on click and deletes it", async () => {
    const onApply = vi.fn();
    useStore.getState().addSnapshot("users:getUser", "reuse me", inputs);
    render(<SnapshotsPanel op={op} onApply={onApply} />);

    await userEvent.click(screen.getByRole("button", { name: "reuse me" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ name: "reuse me" }));

    await userEvent.click(screen.getByRole("button", { name: /delete snapshot reuse me/i }));
    expect(useStore.getState().snapshotsByOperationId["users:getUser"]).toHaveLength(0);
  });
});
