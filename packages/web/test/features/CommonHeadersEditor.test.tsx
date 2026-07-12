import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommonHeadersEditor } from "../../src/features/profiles/CommonHeadersEditor.js";
import { useStore } from "../../src/store/store.js";

const headers = () => useStore.getState().profiles.find((p) => p.profileId === useStore.getState().activeProfileId)!.commonHeaders;

beforeEach(() => { localStorage.clear(); useStore.setState(useStore.getInitialState(), true); });

describe("CommonHeadersEditor", () => {
  it("adds a header to the active profile", async () => {
    render(<CommonHeadersEditor />);
    await userEvent.type(screen.getByPlaceholderText("Header"), "Authorization");
    await userEvent.type(screen.getByPlaceholderText("Value"), "Bearer t");
    expect(headers()).toEqual([{ name: "Authorization", value: "Bearer t" }]);
  });

  it("removes a header via the trash button", async () => {
    useStore.getState().setCommonHeaders([{ name: "X-A", value: "1" }, { name: "X-B", value: "2" }]);
    render(<CommonHeadersEditor />);
    await userEvent.click(screen.getByRole("button", { name: /remove header X-A/i }));
    expect(headers()).toEqual([{ name: "X-B", value: "2" }]);
  });

  it("toggles a header's enabled state and persists it", async () => {
    useStore.getState().setCommonHeaders([{ name: "X-A", value: "1" }]);
    render(<CommonHeadersEditor />);
    // Enabled by default → the checkbox offers to disable it.
    await userEvent.click(screen.getByRole("checkbox", { name: /disable header X-A/i }));
    expect(headers()).toEqual([{ name: "X-A", value: "1", enabled: false }]);
    // Toggling back re-enables it.
    await userEvent.click(screen.getByRole("checkbox", { name: /enable header X-A/i }));
    expect(headers()).toEqual([{ name: "X-A", value: "1", enabled: true }]);
  });

  it("renders without crashing for a legacy profile missing commonHeaders", () => {
    // A profile persisted before the `auth` → `commonHeaders` rename has no commonHeaders.
    useStore.setState({ profiles: [{ profileId: "default", name: "Default", operationIds: [] } as any], activeProfileId: "default" });
    render(<CommonHeadersEditor />);
    // Falls back to a single empty row instead of throwing on `undefined.length`.
    expect(screen.getByPlaceholderText("Header")).toBeInTheDocument();
  });

  it("flags a duplicate header name case-insensitively", () => {
    useStore.getState().setCommonHeaders([{ name: "Authorization", value: "1" }, { name: "authorization", value: "2" }]);
    render(<CommonHeadersEditor />);
    // Both rows collide (case-insensitive), so the warning renders for each.
    expect(screen.getAllByText(/duplicate header name/i).length).toBeGreaterThanOrEqual(1);
  });
});
