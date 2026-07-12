import { describe, it, expect } from "vitest";
import { buildProfileExport, exportFilename, parseProfileImport, PROFILE_EXPORT_KIND, PROFILE_EXPORT_VERSION } from "../../src/features/profiles/profileExport.js";
import type { Profile } from "../../src/store/store.types.js";

const profiles: Profile[] = [
  { profileId: "default", name: "Default", operationIds: ["a"], commonHeaders: [{ name: "X", value: "1" }], variables: { k: "v" }, history: [{ id: "h" } as any] },
  { profileId: "p2", name: "Staging Env", operationIds: [], commonHeaders: [], variables: {}, history: [] },
  { profileId: "p3", name: "Prod", operationIds: ["b", "c"], commonHeaders: [], variables: {} },
];

describe("buildProfileExport", () => {
  it("includes only the selected profiles", () => {
    const env = buildProfileExport(profiles, ["p2", "p3"], "2026-07-08T00:00:00.000Z");
    expect(env.profiles.map((p) => p.name)).toEqual(["Staging Env", "Prod"]);
  });

  it("stamps the format marker, version, and timestamp", () => {
    const env = buildProfileExport(profiles, ["default"], "2026-07-08T00:00:00.000Z");
    expect(env.kind).toBe(PROFILE_EXPORT_KIND);
    expect(env.version).toBe(PROFILE_EXPORT_VERSION);
    expect(env.exportedAt).toBe("2026-07-08T00:00:00.000Z");
  });

  it("keeps config (bookmarks, common headers, variables) but drops history and credentials", () => {
    const withSecret = profiles.map((p) =>
      p.profileId === "default" ? { ...p, authValues: { bearerAuth: { value: "secret-token" } } } : p,
    );
    const env = buildProfileExport(withSecret, ["default"]);
    const p = env.profiles[0];
    expect(p.operationIds).toEqual(["a"]);
    expect(p.commonHeaders).toEqual([{ name: "X", value: "1" }]);
    expect(p.variables).toEqual({ k: "v" });
    expect("history" in p).toBe(false);
    // Credentials must never be exported.
    expect("authValues" in p).toBe(false);
    expect(JSON.stringify(env)).not.toContain("secret-token");
  });

  it("ignores unknown ids and preserves store order", () => {
    const env = buildProfileExport(profiles, ["p3", "nope", "default"]);
    expect(env.profiles.map((p) => p.profileId)).toEqual(["default", "p3"]);
  });
});

describe("parseProfileImport", () => {
  it("round-trips a built export back to config-only profiles", () => {
    const env = buildProfileExport(profiles, ["default", "p2"]);
    const parsed = parseProfileImport(JSON.stringify(env));
    expect(parsed.map((p) => p.name)).toEqual(["Default", "Staging Env"]);
    expect(parsed[0].commonHeaders).toEqual([{ name: "X", value: "1" }]);
    expect(parsed[0].variables).toEqual({ k: "v" });
  });

  it("rejects non-JSON, wrong-kind, and profile-less files", () => {
    expect(() => parseProfileImport("not json")).toThrow(/valid JSON/i);
    expect(() => parseProfileImport(JSON.stringify({ kind: "something.else", profiles: [] }))).toThrow(/Swaggy profiles export/i);
    expect(() => parseProfileImport(JSON.stringify({ kind: PROFILE_EXPORT_KIND, profiles: [{ name: "" }] }))).toThrow(/no valid profiles/i);
  });

  it("sanitizes malformed fields and strips any smuggled credentials/history", () => {
    const dirty = {
      kind: PROFILE_EXPORT_KIND,
      version: 1,
      profiles: [
        { name: "  Trimmed  ", operationIds: ["a", 5, "b"], commonHeaders: [{ name: "H", value: "v", enabled: false }, { name: "bad" }], variables: { ok: "1", nope: 2 }, authValues: { x: { value: "SECRET" } }, history: [{ id: "h" }] },
      ],
    };
    const [p] = parseProfileImport(JSON.stringify(dirty));
    expect(p.name).toBe("Trimmed");
    expect(p.operationIds).toEqual(["a", "b"]);
    expect(p.commonHeaders).toEqual([{ name: "H", value: "v", enabled: false }]);
    expect(p.variables).toEqual({ ok: "1" });
    expect("authValues" in p).toBe(false);
    expect("history" in p).toBe(false);
  });
});

describe("exportFilename", () => {
  const date = new Date("2026-07-08T12:00:00.000Z");
  it("names a single profile after it (slugified)", () => {
    expect(exportFilename([{ profileId: "p2", name: "Staging Env", operationIds: [], commonHeaders: [], variables: {} }], date)).toBe(
      "swaggy-profile-staging-env-2026-07-08.json",
    );
  });
  it("falls back to a dated bundle for multiple profiles", () => {
    expect(
      exportFilename(
        [
          { profileId: "a", name: "A", operationIds: [], commonHeaders: [], variables: {} },
          { profileId: "b", name: "B", operationIds: [], commonHeaders: [], variables: {} },
        ],
        date,
      ),
    ).toBe("swaggy-profiles-2026-07-08.json");
  });
  it("uses a fallback slug when the name has no usable characters", () => {
    expect(exportFilename([{ profileId: "x", name: "!!!", operationIds: [], commonHeaders: [], variables: {} }], date)).toBe(
      "swaggy-profile-profile-2026-07-08.json",
    );
  });
});
