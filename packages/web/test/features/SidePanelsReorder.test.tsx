import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidePanels } from "../../src/features/request/SidePanels.js";
import { useStore } from "../../src/store/store.js";

beforeEach(() => {
  localStorage.clear();
  useStore.setState(useStore.getInitialState(), true);
});

const draggableHeaderOf = (title: string) => screen.getByText(title).closest("[draggable='true']") as HTMLElement;
const sectionOf = (title: string) => screen.getByText(title).closest("section") as HTMLElement;

describe("SidePanels reorder + resize", () => {
  it("reorders cards on drag-and-drop and persists the new order", () => {
    render(<SidePanels op={null} onReplay={vi.fn()} />);
    fireEvent.dragStart(draggableHeaderOf("History"));
    fireEvent.drop(sectionOf("Snapshots"));
    expect(useStore.getState().sidePanelOrder).toEqual(["history", "snapshots", "authorization", "commonHeaders", "variables"]);
  });

  it("exposes a per-card resize handle for an open card", () => {
    render(<SidePanels op={null} onReplay={vi.fn()} />);
    // Snapshots is open by default, so its body is resizable.
    expect(screen.getByRole("separator", { name: /resize snapshots panel/i })).toBeInTheDocument();
  });

  it("persists a card height via the store setter", () => {
    useStore.getState().setSidePanelHeight("snapshots", 300);
    expect(useStore.getState().sidePanelHeights.snapshots).toBe(300);
  });
});
