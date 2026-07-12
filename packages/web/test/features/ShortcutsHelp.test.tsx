import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortcutsHelp } from "../../src/features/shortcuts/ShortcutsHelp.js";
import * as reset from "../../src/lib/reset.js";

beforeEach(() => vi.restoreAllMocks());

describe("ShortcutsHelp hard reset", () => {
  it("requires a confirm step before wiping everything", async () => {
    const spy = vi.spyOn(reset, "hardResetApp").mockImplementation(() => {});
    render(<ShortcutsHelp open onClose={vi.fn()} />);

    // The destructive action isn't armed until the user confirms.
    await userEvent.click(screen.getByRole("button", { name: /hard reset/i }));
    expect(screen.getByText(/permanently clears/i)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /reset everything/i }));
    expect(spy).toHaveBeenCalledOnce();
  });

  it("can back out of the confirm step", async () => {
    const spy = vi.spyOn(reset, "hardResetApp").mockImplementation(() => {});
    render(<ShortcutsHelp open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /hard reset/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/permanently clears/i)).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});
