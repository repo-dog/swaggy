import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResizableSidebar, clampSidebarWidth } from "../../src/features/layout/ResizableSidebar.js";

describe("clampSidebarWidth", () => {
  it("caps width at 30% of the viewport", () => {
    expect(clampSidebarWidth(900, 1000)).toBe(300); // 30% of 1000
  });
  it("enforces a minimum width", () => {
    expect(clampSidebarWidth(50, 1000)).toBe(200);
  });
  it("leaves an in-range width untouched", () => {
    expect(clampSidebarWidth(280, 1000)).toBe(280);
  });
});

describe("ResizableSidebar", () => {
  const base = {
    side: "left" as const,
    label: "Operations",
    width: 300,
    onWidth: () => {},
    defaultWidth: 320,
    collapsed: false,
    onCollapsedChange: () => {},
  };

  it("renders content and a resize handle when expanded", () => {
    render(<ResizableSidebar {...base}><p>panel body</p></ResizableSidebar>);
    expect(screen.getByText("panel body")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: /resize operations/i })).toBeInTheDocument();
  });

  it("resets to the default width when the resize handle is double-clicked", async () => {
    const onWidth = vi.fn();
    render(<ResizableSidebar {...base} width={520} defaultWidth={320} onWidth={onWidth}><p>panel body</p></ResizableSidebar>);
    await userEvent.dblClick(screen.getByRole("separator", { name: /resize operations/i }));
    expect(onWidth).toHaveBeenCalledWith(320);
  });

  it("collapses via the hide control", async () => {
    const onCollapsedChange = vi.fn();
    render(<ResizableSidebar {...base} onCollapsedChange={onCollapsedChange}><p>panel body</p></ResizableSidebar>);
    await userEvent.click(screen.getByRole("button", { name: /hide operations/i }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it("when collapsed shows only an expand strip (no content)", async () => {
    const onCollapsedChange = vi.fn();
    render(<ResizableSidebar {...base} collapsed onCollapsedChange={onCollapsedChange}><p>panel body</p></ResizableSidebar>);
    expect(screen.queryByText("panel body")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /show operations/i }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });
});
