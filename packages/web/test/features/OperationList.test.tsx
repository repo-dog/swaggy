import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationList } from "../../src/features/operations/OperationList.js";
import { useStore } from "../../src/store/store.js";
import * as api from "../../src/lib/api.js";
import type { Operation } from "@swaggy/shared";

const ops: Operation[] = [
  { id: "users:getUser", specId: "users", specTitle: "Users", method: "GET", path: "/users/{id}", summary: "Get a user", description: "", tags: ["Users"], servers: ["https://a"], pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [] },
  { id: "orders:createOrder", specId: "orders", specTitle: "Orders", method: "POST", path: "/orders", summary: "Create order", description: "", tags: ["Orders"], servers: ["https://b"], pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [] },
];

function renderList(onSelect = vi.fn()) {
  vi.spyOn(api, "getOperations").mockResolvedValue(ops);
  vi.spyOn(api, "getSpecs").mockResolvedValue([]);
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}><OperationList selectedId={null} onSelect={onSelect} /></QueryClientProvider>,
  );
  return onSelect;
}

beforeEach(() => {
  localStorage.clear();
  useStore.setState(useStore.getInitialState(), true);
  vi.clearAllMocks();
});

describe("OperationList", () => {
  it("scopes the tag groups to the first spec by default (specs not merged)", async () => {
    renderList();
    // Default resolves to the first spec (users); the other spec's group is hidden.
    expect(await screen.findByText(/Users \(1\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Orders \(1\)/)).not.toBeInTheDocument();
  });

  it("offers a spec dropdown that switches which spec's operations are shown", async () => {
    renderList();
    const select = await screen.findByRole("combobox", { name: /spec/i });
    // Only the active spec's rows are visible up front.
    expect(screen.getByText("/users/{id}")).toBeInTheDocument();
    expect(screen.queryByText("/orders")).not.toBeInTheDocument();

    await userEvent.selectOptions(select, "orders");
    expect(useStore.getState().activeSpecId).toBe("orders");
    expect(await screen.findByText("/orders")).toBeInTheDocument();
    expect(screen.queryByText("/users/{id}")).not.toBeInTheDocument();
  });

  it("shows a Bookmarks section for the active profile's bookmarks", async () => {
    useStore.getState().toggleBookmark("users:getUser");
    renderList();
    expect(await screen.findByText(/Bookmarks \(1\)/)).toBeInTheDocument();
    // bookmarked op (in the active spec) renders in both the Bookmarks section and its tag group
    expect(screen.getAllByText("/users/{id}").length).toBeGreaterThanOrEqual(2);
  });

  it("pins the bookmarks section outside the scroller by default, and can unpin it", async () => {
    useStore.getState().toggleBookmark("users:getUser");
    renderList();
    const bm = (await screen.findByText(/Bookmarks \(1\)/)).closest("details")!;
    // Pinned by default → the bookmarks section lives OUTSIDE the scrolling list.
    expect(document.getElementById("sidebar-scroll")!.contains(bm)).toBe(false);
    // Toggling the pin moves it into the scroller.
    await userEvent.click(screen.getByRole("button", { name: /unpin bookmarks/i }));
    expect(useStore.getState().bookmarksPinned).toBe(false);
    const bm2 = (await screen.findByText(/Bookmarks \(1\)/)).closest("details")!;
    expect(document.getElementById("sidebar-scroll")!.contains(bm2)).toBe(true);
  });

  it("caps the pinned bookmarks region at 30% of the sidebar height", async () => {
    useStore.getState().toggleBookmark("users:getUser");
    renderList();
    const bm = (await screen.findByText(/Bookmarks \(1\)/)).closest("details")!;
    // The pinned wrapper (bookmarks' offset parent region) is capped and scrolls internally.
    const region = bm.parentElement!;
    expect(region.style.maxHeight).toBe("30%");
    expect(region.className).toContain("overflow-y-auto");
  });

  it("clears the selected operation when switching specs", async () => {
    useStore.getState().setSelectedOperation("users:getUser");
    renderList();
    await screen.findByText(/Users \(1\)/);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /spec/i }), "orders");
    expect(useStore.getState().activeSpecId).toBe("orders");
    // No operation from the old spec stays selected.
    expect(useStore.getState().selectedOperationId).toBeNull();
  });

  it("scopes bookmarks to the active spec", async () => {
    // Bookmark an op that lives in a non-active spec (default spec is users).
    useStore.getState().toggleBookmark("orders:createOrder");
    renderList();
    await screen.findByText(/Users \(1\)/);
    // The bookmark belongs to the orders spec, so it isn't shown while viewing users.
    expect(screen.queryByText(/Bookmarks/)).not.toBeInTheDocument();
    expect(screen.queryByText("/orders")).not.toBeInTheDocument();

    // Switching to the orders spec surfaces its bookmark.
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /spec/i }), "orders");
    expect(await screen.findByText(/Bookmarks \(1\)/)).toBeInTheDocument();
    expect(screen.getAllByText("/orders").length).toBeGreaterThanOrEqual(2);
  });

  it("no longer has a bookmarked-only checkbox", async () => {
    renderList();
    await screen.findByText(/Users \(1\)/);
    expect(screen.queryByText(/bookmarked only/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("calls onSelect when a row is clicked", async () => {
    const onSelect = renderList();
    await userEvent.click(await screen.findByText("/users/{id}"));
    expect(onSelect).toHaveBeenCalledWith("users:getUser");
  });

  it("shows Collapse all by default (sections open) and toggles all sections", async () => {
    renderList();
    const button = await screen.findByRole("button", { name: /collapse all/i });
    await userEvent.click(button);
    // Every section is now collapsed in the store...
    expect(Object.values(useStore.getState().sidebarSections).every((v) => v === false)).toBe(true);
    // ...and the button flips to Expand all.
    expect(await screen.findByRole("button", { name: /expand all/i })).toBeInTheDocument();
  });

  it("toggles a bookmark from the star on each row", async () => {
    renderList();
    const row = (await screen.findByText("/users/{id}")).closest("[data-op-id]")!;
    await userEvent.click(within(row as HTMLElement).getByRole("button", { name: /add bookmark/i }));
    expect(useStore.getState().isBookmarked("users:getUser")).toBe(true);
  });

  it("reorders bookmarks via drag and drop", async () => {
    // Two ops in a single spec so both bookmarks show together (bookmarks are spec-scoped).
    const sameSpec: Operation[] = [
      { ...ops[0], id: "users:a", path: "/a" },
      { ...ops[0], id: "users:b", path: "/b" },
    ];
    vi.spyOn(api, "getOperations").mockResolvedValue(sameSpec);
    vi.spyOn(api, "getSpecs").mockResolvedValue([]);
    useStore.getState().toggleBookmark("users:a");
    useStore.getState().toggleBookmark("users:b");
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><OperationList selectedId={null} onSelect={vi.fn()} /></QueryClientProvider>);

    const bookmarks = (await screen.findByText(/Bookmarks \(2\)/)).closest("details")!;
    const rows = within(bookmarks as HTMLElement).getAllByRole("button", { name: /add bookmark|remove bookmark/i })
      .map((b) => b.closest("[data-op-id]") as HTMLElement);
    // Initial order matches the order they were bookmarked in.
    expect(rows.map((r) => r.getAttribute("data-op-id"))).toEqual(["users:a", "users:b"]);

    // Drag the second bookmark onto the first.
    fireEvent.dragStart(rows[1]);
    fireEvent.drop(rows[0]);

    const p = useStore.getState().profiles.find((pr) => pr.profileId === "default")!;
    expect(p.operationIds).toEqual(["users:b", "users:a"]);
  });

  it("gives every row a top separator, including the first (not just from the second)", async () => {
    // Two operations under one section, in a single spec so both render together.
    const sameSpec: Operation[] = [
      { ...ops[0], id: "s:a", specId: "svc", specTitle: "Svc", path: "/a", tags: ["Group"] },
      { ...ops[0], id: "s:b", specId: "svc", specTitle: "Svc", path: "/b", tags: ["Group"] },
    ];
    vi.spyOn(api, "getOperations").mockResolvedValue(sameSpec);
    vi.spyOn(api, "getSpecs").mockResolvedValue([]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><OperationList selectedId={null} onSelect={vi.fn()} /></QueryClientProvider>);
    await screen.findByText(/Group \(2\)/);
    const rows = ["s:a", "s:b"].map((id) => document.querySelector(`[data-op-id="${id}"]`)!);
    // The first row must be bordered too — the reported bug was the rule starting at row 2.
    for (const row of rows) expect(row).toHaveClass("border-t");
  });

  it("reorders sections via drag and drop and persists the order", async () => {
    // Two tags within a single spec, so both sections render together and can be reordered.
    const sameSpec: Operation[] = [
      { ...ops[0], id: "users:getUser", specId: "svc", specTitle: "Svc", tags: ["Users"] },
      { ...ops[1], id: "svc:createOrder", specId: "svc", specTitle: "Svc", path: "/orders", tags: ["Orders"] },
    ];
    vi.spyOn(api, "getOperations").mockResolvedValue(sameSpec);
    vi.spyOn(api, "getSpecs").mockResolvedValue([]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><OperationList selectedId={null} onSelect={vi.fn()} /></QueryClientProvider>);

    // Natural order is alphabetical: Orders, then Users.
    const orders = (await screen.findByText(/Orders \(1\)/)).closest("summary")!;
    const users = (await screen.findByText(/Users \(1\)/)).closest("summary")!;

    // Drag Users onto Orders → Users should come first.
    fireEvent.dragStart(users);
    fireEvent.drop(orders);

    expect(useStore.getState().sectionOrder).toEqual(["Users", "Orders"]);
  });

  it("expands the selected operation's section when selection changes", async () => {
    vi.spyOn(api, "getOperations").mockResolvedValue(ops);
    vi.spyOn(api, "getSpecs").mockResolvedValue([]);
    const qc = new QueryClient();
    const wrap = (id: string | null) => (
      <QueryClientProvider client={qc}><OperationList selectedId={id} onSelect={vi.fn()} /></QueryClientProvider>
    );
    const { rerender } = render(wrap(null));
    // Default spec is users; the Orders group isn't shown yet.
    await screen.findByText(/Users \(1\)/);
    act(() => useStore.getState().setAllSections(["Users", "Orders"], false));

    // Selecting an op in the other spec switches to it and expands its section.
    rerender(wrap("orders:createOrder"));
    expect(useStore.getState().activeSpecId).toBe("orders");
    expect(useStore.getState().sidebarSections["Orders"]).toBe(true);
    expect(await screen.findByText(/Orders \(1\)/)).toBeInTheDocument();
  });
});
