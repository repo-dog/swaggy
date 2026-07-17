import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsDialog } from "../../src/features/settings/SettingsDialog.js";
import { useStore } from "../../src/store/store.js";
import * as reset from "../../src/lib/reset.js";

beforeEach(() => {
  localStorage.clear();
  useStore.setState(useStore.getInitialState(), true);
  vi.restoreAllMocks();
});

describe("SettingsDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SettingsDialog open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<SettingsDialog open onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows Export and Import buttons in the Profiles section", () => {
    render(<SettingsDialog open onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /export profiles/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import profiles/i })).toBeInTheDocument();
  });

  it("toggles simpleLabels via the checkbox", async () => {
    render(<SettingsDialog open onClose={vi.fn()} />);
    expect(useStore.getState().simpleLabels).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: /human-readable/i }));
    expect(useStore.getState().simpleLabels).toBe(false);
  });

  it("requires a confirm step before hard reset fires", async () => {
    const spy = vi.spyOn(reset, "hardResetApp").mockImplementation(() => {});
    render(<SettingsDialog open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /hard reset/i }));
    expect(screen.getByText(/permanently clears/i)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /reset everything/i }));
    expect(spy).toHaveBeenCalledOnce();
  });

  it("can back out of the confirm step", async () => {
    const spy = vi.spyOn(reset, "hardResetApp").mockImplementation(() => {});
    render(<SettingsDialog open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /hard reset/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/permanently clears/i)).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("shows Compact and Comfortable density options", () => {
    render(<SettingsDialog open onClose={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /compact/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /comfortable/i })).toBeInTheDocument();
  });

  it("compact radio is checked by default", () => {
    render(<SettingsDialog open onClose={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /compact/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /comfortable/i })).not.toBeChecked();
  });

  it("clicking comfortable updates density in store", async () => {
    render(<SettingsDialog open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: /comfortable/i }));
    expect(useStore.getState().density).toBe("comfortable");
  });

  it("clicking compact after comfortable sets density back to compact", async () => {
    useStore.setState({ density: "comfortable" });
    render(<SettingsDialog open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: /compact/i }));
    expect(useStore.getState().density).toBe("compact");
  });
});
