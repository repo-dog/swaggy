import { describe, it, expect, beforeEach } from "vitest";
import { useStore, HISTORY_CAP, MAX_BODY_BYTES, INPUTS_CAP, RESPONSES_CAP, SNAPSHOTS_PER_OP } from "../../src/store/store.js";
import type { RequestInputs } from "../../src/store/store.types.js";

function reset() {
  localStorage.clear();
  useStore.persist.clearStorage();
  useStore.setState(useStore.getInitialState(), true);
}

beforeEach(() => reset());

const s = () => useStore.getState();

describe("profiles", () => {
  it("starts with a default profile that is active", () => {
    expect(s().profiles.find((p) => p.profileId === "default")).toBeTruthy();
    expect(s().activeProfileId).toBe("default");
  });

  it("creates and activates a new profile", () => {
    const id = s().createProfile("task-x");
    expect(s().activeProfileId).toBe(id);
    expect(s().profiles.find((p) => p.profileId === id)?.name).toBe("task-x");
  });

  it("refuses to delete the default profile", () => {
    s().deleteProfile("default");
    expect(s().profiles.find((p) => p.profileId === "default")).toBeTruthy();
  });

  it("re-points active profile to default after deleting the active one", () => {
    const id = s().createProfile("temp");
    s().deleteProfile(id);
    expect(s().activeProfileId).toBe("default");
  });

  it("imports profiles with fresh ids, de-duplicated names, no history, and activates the first", () => {
    const ids = s().importProfiles([
      { profileId: "old", name: "Default", operationIds: ["x"], commonHeaders: [{ name: "H", value: "v" }], variables: { a: "1" } },
      { profileId: "old2", name: "Staging", operationIds: [], commonHeaders: [], variables: {} },
    ]);
    expect(ids).toHaveLength(2);
    const names = s().profiles.map((p) => p.name);
    // "Default" already exists, so the import is renamed rather than clobbering it.
    expect(names).toEqual(["Default", "Default (2)", "Staging"]);
    const imported = s().profiles.find((p) => p.profileId === ids[0])!;
    expect(imported.profileId).not.toBe("old"); // fresh id, never overwrites
    expect(imported.history).toEqual([]);
    expect(imported.commonHeaders).toEqual([{ name: "H", value: "v" }]);
    expect(s().activeProfileId).toBe(ids[0]);
  });
});

describe("theme", () => {
  it("defaults to system and cycles system → light → dark → system", () => {
    expect(s().theme).toBe("system");
    s().toggleTheme();
    expect(s().theme).toBe("light");
    s().toggleTheme();
    expect(s().theme).toBe("dark");
    s().toggleTheme();
    expect(s().theme).toBe("system");
  });

  it("sets an explicit theme", () => {
    s().setTheme("dark");
    expect(s().theme).toBe("dark");
  });
});

describe("bookmarks", () => {
  it("toggles a bookmark on the active profile", () => {
    s().toggleBookmark("users:getUser");
    expect(s().isBookmarked("users:getUser")).toBe(true);
    s().toggleBookmark("users:getUser");
    expect(s().isBookmarked("users:getUser")).toBe(false);
  });

  it("reorders bookmarks on the active profile", () => {
    s().toggleBookmark("a");
    s().toggleBookmark("b");
    s().toggleBookmark("c");
    s().setBookmarkOrder(["c", "a", "b"]);
    const p = s().profiles.find((pr) => pr.profileId === s().activeProfileId)!;
    expect(p.operationIds).toEqual(["c", "a", "b"]);
  });
});

describe("variables", () => {
  const vars = () => s().profiles.find((pr) => pr.profileId === s().activeProfileId)!.variables;

  it("sets, overwrites and deletes a variable on the active profile", () => {
    s().setVariable("token", "abc");
    s().setVariable("id", "1");
    expect(vars()).toEqual({ token: "abc", id: "1" });
    s().setVariable("token", "xyz");
    expect(vars()!.token).toBe("xyz");
    s().deleteVariable("id");
    expect(vars()).toEqual({ token: "xyz" });
  });

  it("replaces the whole set with setVariables", () => {
    s().setVariable("a", "1");
    s().setVariables({ b: "2", c: "3" });
    expect(vars()).toEqual({ b: "2", c: "3" });
  });

  it("keeps variables scoped to the profile they were set on", () => {
    s().setVariable("token", "default-tok");
    const id = s().createProfile("staging");
    expect(vars()).toEqual({}); // new profile starts clean
    s().setVariable("token", "staging-tok");
    s().setActiveProfile("default");
    expect(vars()!.token).toBe("default-tok");
    s().setActiveProfile(id);
    expect(vars()!.token).toBe("staging-tok");
  });
});

describe("common headers", () => {
  it("stores common headers on the active profile", () => {
    s().setCommonHeaders([{ name: "Authorization", value: "Bearer x" }]);
    const p = s().profiles.find((pr) => pr.profileId === s().activeProfileId)!;
    expect(p.commonHeaders![0].value).toBe("Bearer x");
  });
});

describe("history", () => {
  const entry = {
    operationId: "users:getUser", durationMs: 5,
    request: { server: "https://a", pathParams: {}, query: {}, headers: {} },
    response: { status: 200, headers: {}, body: { ok: true }, bodyTruncated: false },
  };
  // History lives on the active profile.
  const hist = () => s().profiles.find((p) => p.profileId === s().activeProfileId)!.history!;

  it("appends entries with id + timestamp", () => {
    s().addHistory(entry);
    expect(hist()).toHaveLength(1);
    expect(hist()[0].id).toBeTruthy();
    expect(hist()[0].timestamp).toBeGreaterThan(0);
  });

  it("caps history at HISTORY_CAP, trimming oldest first", () => {
    for (let i = 0; i < HISTORY_CAP + 10; i++) s().addHistory({ ...entry, durationMs: i });
    expect(hist()).toHaveLength(HISTORY_CAP);
    expect(hist()[0].durationMs).toBe(HISTORY_CAP + 9); // newest first
  });

  it("truncates response bodies larger than MAX_BODY_BYTES", () => {
    const big = "x".repeat(MAX_BODY_BYTES + 100);
    s().addHistory({ ...entry, response: { status: 200, headers: {}, body: big, bodyTruncated: false } });
    const stored = hist()[0].response;
    expect(stored.bodyTruncated).toBe(true);
    expect(String(stored.body).length).toBeLessThanOrEqual(MAX_BODY_BYTES);
  });

  it("clears history", () => {
    s().addHistory(entry);
    s().clearHistory();
    expect(hist()).toHaveLength(0);
  });

  it("is scoped per profile — a new profile starts empty and doesn't see another's history", () => {
    s().addHistory(entry);
    expect(hist()).toHaveLength(1);
    const other = s().createProfile("Other"); // also switches active to the new profile
    expect(hist()).toHaveLength(0); // the new profile has its own (empty) log
    s().addHistory({ ...entry, durationMs: 99 });
    expect(hist()[0].durationMs).toBe(99);
    // Switching back shows the original profile's history untouched.
    s().setActiveProfile("default");
    expect(hist()).toHaveLength(1);
    expect(hist()[0].durationMs).toBe(5);
    expect(other).not.toBe("default");
  });
});

describe("bookmarks pinned", () => {
  it("defaults to pinned and toggles", () => {
    expect(s().bookmarksPinned).toBe(true);
    s().setBookmarksPinned(false);
    expect(s().bookmarksPinned).toBe(false);
  });
});

describe("selected operation", () => {
  it("tracks the selected operation id in memory", () => {
    s().setSelectedOperation("users:getUser");
    expect(s().selectedOperationId).toBe("users:getUser");
    s().setSelectedOperation(null);
    expect(s().selectedOperationId).toBeNull();
  });

  it("does not persist the selected operation id (the URL owns what's open)", () => {
    s().setSelectedOperation("users:getUser");
    const persisted = JSON.parse(localStorage.getItem("swaggy.store")!);
    expect("selectedOperationId" in persisted.state).toBe(false);
  });

  it("counts selection frequency but not the null deselect", () => {
    s().setSelectedOperation("users:getUser");
    s().setSelectedOperation("users:getUser");
    s().setSelectedOperation("orders:createOrder");
    s().setSelectedOperation(null);
    expect(s().selectionCountsByOperationId).toEqual({ "users:getUser": 2, "orders:createOrder": 1 });
  });
});

describe("sidebar sections", () => {
  it("stores per-section open state", () => {
    s().setSectionOpen("Users", false);
    expect(s().sidebarSections["Users"]).toBe(false);
  });

  it("sets many sections at once for expand/collapse-all", () => {
    s().setAllSections(["Users", "Orders"], false);
    expect(s().sidebarSections).toEqual({ Users: false, Orders: false });
    s().setAllSections(["Users", "Orders"], true);
    expect(s().sidebarSections).toEqual({ Users: true, Orders: true });
  });

  it("remembers the sidebar scroll offset", () => {
    s().setSidebarScrollTop(420);
    expect(s().sidebarScrollTop).toBe(420);
  });

  it("persists a user-defined section order", () => {
    expect(s().sectionOrder).toEqual([]);
    s().setSectionOrder(["Orders", "Users"]);
    expect(s().sectionOrder).toEqual(["Orders", "Users"]);
  });

  it("persists side-panel card open state (default collapsed)", () => {
    expect(s().sidePanelSections["auth"]).toBeUndefined(); // missing = collapsed
    s().setSidePanelSection("auth", true);
    expect(s().sidePanelSections["auth"]).toBe(true);
    s().setSidePanelSection("auth", false);
    expect(s().sidePanelSections["auth"]).toBe(false);
  });
});

describe("per-operation inputs", () => {
  const inputs = (server: string): RequestInputs => ({ server, pathParams: {}, query: {}, headers: {} });

  it("stores and clears inputs keyed by operation", () => {
    s().setInputs("users:getUser", inputs("https://a"));
    expect(s().inputsByOperationId["users:getUser"].server).toBe("https://a");
    s().clearInputs("users:getUser");
    expect(s().inputsByOperationId["users:getUser"]).toBeUndefined();
  });

  it("caps stored inputs at INPUTS_CAP, evicting the oldest", () => {
    for (let i = 0; i < INPUTS_CAP + 5; i++) s().setInputs(`op-${i}`, inputs(`https://${i}`));
    const keys = Object.keys(s().inputsByOperationId);
    expect(keys).toHaveLength(INPUTS_CAP);
    expect(keys).not.toContain("op-0"); // oldest evicted
    expect(keys).toContain(`op-${INPUTS_CAP + 4}`); // newest kept
  });
});

describe("per-operation last response", () => {
  const okResult = { ok: true as const, response: { status: 200, statusText: "OK", headers: {}, body: { id: "1" }, durationMs: 3, bodySize: 9 } };

  it("stores and clears the last response keyed by operation", () => {
    s().setLastResponse("users:getUser", { kind: "result", result: okResult });
    expect(s().lastResponseByOperationId["users:getUser"]).toEqual({ kind: "result", result: okResult });
    s().clearResponse("users:getUser");
    expect(s().lastResponseByOperationId["users:getUser"]).toBeUndefined();
  });

  it("truncates large response bodies", () => {
    const big = "x".repeat(MAX_BODY_BYTES + 100);
    s().setLastResponse("op", { kind: "result", result: { ok: true, response: { ...okResult.response, body: big } } });
    const stored = s().lastResponseByOperationId["op"];
    expect(stored.kind).toBe("result");
    if (stored.kind === "result" && stored.result.ok) {
      expect(String(stored.result.response.body).length).toBeLessThanOrEqual(MAX_BODY_BYTES);
    }
  });

  it("caps stored responses at RESPONSES_CAP", () => {
    for (let i = 0; i < RESPONSES_CAP + 5; i++) s().setLastResponse(`op-${i}`, { kind: "network_error", message: `e${i}` });
    expect(Object.keys(s().lastResponseByOperationId)).toHaveLength(RESPONSES_CAP);
  });
});

describe("snapshots", () => {
  const inputs = (server: string): RequestInputs => ({ server, pathParams: {}, query: {}, headers: {} });

  it("saves snapshots newest-first per operation", () => {
    s().addSnapshot("op", "first", inputs("https://a"));
    s().addSnapshot("op", "second", inputs("https://b"));
    const list = s().snapshotsByOperationId["op"];
    expect(list.map((x) => x.name)).toEqual(["second", "first"]);
    expect(list[0].id).toBeTruthy();
    expect(list[0].createdAt).toBeGreaterThan(0);
  });

  it("renames and deletes snapshots", () => {
    const id = s().addSnapshot("op", "draft", inputs("https://a"));
    s().renameSnapshot("op", id, "final");
    expect(s().snapshotsByOperationId["op"][0].name).toBe("final");
    s().deleteSnapshot("op", id);
    expect(s().snapshotsByOperationId["op"]).toHaveLength(0);
  });

  it("keeps snapshots scoped to their operation", () => {
    s().addSnapshot("op-a", "a", inputs("https://a"));
    s().addSnapshot("op-b", "b", inputs("https://b"));
    expect(s().snapshotsByOperationId["op-a"]).toHaveLength(1);
    expect(s().snapshotsByOperationId["op-b"][0].name).toBe("b");
  });

  it("caps snapshots per operation at SNAPSHOTS_PER_OP", () => {
    for (let i = 0; i < SNAPSHOTS_PER_OP + 5; i++) s().addSnapshot("op", `snap-${i}`, inputs(`https://${i}`));
    const list = s().snapshotsByOperationId["op"];
    expect(list).toHaveLength(SNAPSHOTS_PER_OP);
    expect(list[0].name).toBe(`snap-${SNAPSHOTS_PER_OP + 4}`); // newest kept
  });
});

describe("sidebarSearch", () => {
  it("defaults to empty string", () => {
    expect(s().sidebarSearch).toBe("");
  });

  it("setSidebarSearch updates and is persisted", () => {
    s().setSidebarSearch("users");
    expect(s().sidebarSearch).toBe("users");
  });
});

describe("simpleLabels", () => {
  it("defaults to true", () => {
    expect(s().simpleLabels).toBe(true);
  });

  it("setSimpleLabels toggles the value", () => {
    s().setSimpleLabels(false);
    expect(s().simpleLabels).toBe(false);
    s().setSimpleLabels(true);
    expect(s().simpleLabels).toBe(true);
  });
});
