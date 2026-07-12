import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JsonView } from "../../src/features/response/JsonView.js";

const writeText = vi.fn();
beforeEach(() => {
  writeText.mockReset();
  Object.assign(navigator, { clipboard: { writeText } });
});

describe("JsonView", () => {
  it("renders keys and values and copies a string leaf raw (unquoted)", async () => {
    render(<JsonView data={{ name: "alice", age: 30 }} />);
    expect(screen.getByText("name:")).toBeInTheDocument();
    expect(screen.getByText('"alice"')).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy name" }));
    expect(writeText).toHaveBeenCalledWith("alice");
  });

  it("copies a numeric leaf as JSON text", async () => {
    render(<JsonView data={{ age: 30 }} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy age" }));
    expect(writeText).toHaveBeenCalledWith("30");
  });

  it("copies an entire subtree as pretty JSON", async () => {
    render(<JsonView data={{ user: { id: 1 } }} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy user" }));
    expect(writeText).toHaveBeenCalledWith(JSON.stringify({ id: 1 }, null, 2));
  });

  it("collapses a container to hide its children", async () => {
    render(<JsonView data={{ user: { id: 1 } }} />);
    expect(screen.getByText("id:")).toBeInTheDocument();
    // The first Collapse toggle is the top-level object.
    await userEvent.click(screen.getAllByRole("button", { name: /collapse/i })[0]);
    expect(screen.queryByText("id:")).not.toBeInTheDocument();
  });

  it("filters the tree by key or value, hiding non-matches", async () => {
    render(<JsonView data={{ name: "alice", city: "paris" }} />);
    await userEvent.type(screen.getByLabelText(/filter response/i), "paris");
    expect(screen.getByText("city:")).toBeInTheDocument();
    expect(screen.queryByText("name:")).not.toBeInTheDocument();
  });

  it("keeps the filter bar sticky at the top of the scroll area", () => {
    render(<JsonView data={{ a: 1 }} />);
    const bar = screen.getByLabelText(/filter response/i).parentElement!;
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("top-0");
  });

  it("shows a 'No matches' message when nothing matches", async () => {
    render(<JsonView data={{ name: "alice" }} />);
    await userEvent.type(screen.getByLabelText(/filter response/i), "zzz");
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });

  it("offers a capture button per node when onCapture is provided", async () => {
    const onCapture = vi.fn();
    render(<JsonView data={{ token: "abc" }} onCapture={onCapture} />);
    await userEvent.click(screen.getByRole("button", { name: /save token as variable/i }));
    expect(onCapture).toHaveBeenCalledWith("abc", "token");
  });

  it("has no capture buttons when onCapture is omitted", () => {
    render(<JsonView data={{ token: "abc" }} />);
    expect(screen.queryByRole("button", { name: /save .* as variable/i })).not.toBeInTheDocument();
  });

  it("keeps copy + capture inline after the value, set off and spaced apart", () => {
    render(<JsonView data={{ token: "abc" }} onCapture={vi.fn()} />);
    const copy = screen.getByRole("button", { name: "Copy token" });
    const capture = screen.getByRole("button", { name: /save token as variable/i });
    // Both live in one inline cluster, spaced from the value (ml-) and from each other (gap-)…
    const cluster = copy.parentElement!;
    expect(capture.parentElement).toBe(cluster);
    expect(cluster.className).toContain("ml-");
    expect(cluster.className).toContain("gap-");
    // …and stay next to the value rather than being right-aligned or hover-hidden.
    expect(cluster.className).not.toContain("ml-auto");
    expect(cluster.className).not.toContain("opacity-0");
  });
});
