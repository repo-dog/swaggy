import type { CommonHeader, Profile } from "../../store/store.types.js";

/** A profile with only its shareable configuration. Excluded: `history` (a personal,
 * potentially large activity log) and `authValues` (credentials — bearer/OAuth tokens, basic
 * passwords, client secrets — which must never end up in a shared file). */
export type ExportedProfile = Omit<Profile, "history" | "authValues">;

export type ProfileExport = {
  kind: typeof PROFILE_EXPORT_KIND;
  version: number;
  exportedAt: string;
  profiles: ExportedProfile[];
};

/** File-format marker + version so a future import can recognize and validate the file. */
export const PROFILE_EXPORT_KIND = "swaggy.profiles";
export const PROFILE_EXPORT_VERSION = 1;

/** Build the export envelope for the chosen profiles: their config (bookmarks, common
 * headers, variables) without the request/response history. */
export function buildProfileExport(
  profiles: Profile[],
  selectedIds: string[],
  exportedAt: string = new Date().toISOString(),
): ProfileExport {
  const wanted = new Set(selectedIds);
  const selected = profiles
    .filter((p) => wanted.has(p.profileId))
    // Drop history + authValues (credentials); keep profileId/name/operationIds/
    // commonHeaders/variables.
    .map(({ history: _history, authValues: _authValues, ...config }) => config);
  return { kind: PROFILE_EXPORT_KIND, version: PROFILE_EXPORT_VERSION, exportedAt, profiles: selected };
}

/** Sanitize an untrusted common-headers array from an imported file into well-formed rows. */
function coerceCommonHeaders(raw: unknown): CommonHeader[] {
  if (!Array.isArray(raw)) return [];
  const out: CommonHeader[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const h = item as Record<string, unknown>;
    if (typeof h.name !== "string" || typeof h.value !== "string") continue;
    out.push({ name: h.name, value: h.value, ...(typeof h.enabled === "boolean" ? { enabled: h.enabled } : {}) });
  }
  return out;
}

/** Parse and validate a downloaded profiles export back into config-only profiles. Throws a
 * user-facing Error when the file isn't a recognizable Swaggy profiles export. Credentials and
 * history are never present in the file, so they're simply absent here. */
export function parseProfileImport(text: string): ExportedProfile[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn’t valid JSON.");
  }
  if (!data || typeof data !== "object") throw new Error("Unrecognized file format.");
  const env = data as Record<string, unknown>;
  if (env.kind !== PROFILE_EXPORT_KIND) throw new Error("This doesn’t look like a Swaggy profiles export.");
  if (!Array.isArray(env.profiles)) throw new Error("The file contains no profiles.");

  const profiles: ExportedProfile[] = [];
  for (const raw of env.profiles) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const name = typeof p.name === "string" ? p.name.trim() : "";
    if (!name) continue;
    profiles.push({
      profileId: typeof p.profileId === "string" ? p.profileId : "",
      name,
      operationIds: Array.isArray(p.operationIds) ? p.operationIds.filter((x): x is string => typeof x === "string") : [],
      commonHeaders: coerceCommonHeaders(p.commonHeaders),
      variables:
        p.variables && typeof p.variables === "object"
          ? Object.fromEntries(Object.entries(p.variables as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [string, string][])
          : {},
    });
  }
  if (profiles.length === 0) throw new Error("No valid profiles were found in the file.");
  return profiles;
}

/** A stable, human-readable download filename: single profiles are named after the profile,
 * multiple are a dated bundle. */
export function exportFilename(profiles: ExportedProfile[], date: Date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  if (profiles.length === 1) {
    const slug = profiles[0].name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "profile";
    return `swaggy-profile-${slug}-${stamp}.json`;
  }
  return `swaggy-profiles-${stamp}.json`;
}
