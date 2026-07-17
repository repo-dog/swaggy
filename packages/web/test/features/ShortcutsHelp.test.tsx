import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortcutsHelp } from "../../src/features/shortcuts/ShortcutsHelp.js";

beforeEach(() => vi.restoreAllMocks());

describe("ShortcutsHelp", () => {
  it("lists ⌘/Ctrl , as the settings shortcut", () => {
    render(<ShortcutsHelp open onClose={vi.fn()} />);
    expect(screen.getByText("⌘/Ctrl ,")).toBeInTheDocument();
  });

  it("does not contain hard reset controls (moved to Settings)", () => {
    render(<ShortcutsHelp open onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /hard reset/i })).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<ShortcutsHelp open onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
