import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";

/**
 * Resolve the config file path:
 * 1. If envPath is set, return it as-is (caller's responsibility, relative to CWD).
 * 2. Otherwise walk up from startDir looking for `specs.config.json`; return the first hit.
 * 3. If none found, return "specs.config.json" (preserves prior default behavior).
 *
 * @param startDir - Starting directory to search from (typically process.cwd())
 * @param envPath - Optional path from SWAGGY_CONFIG env var
 * @param fileExists - Injectable function to check file existence (defaults to existsSync)
 * @returns The resolved config file path
 */
export function resolveConfigPath(
  startDir: string,
  envPath: string | undefined,
  fileExists: (p: string) => boolean = existsSync,
): string {
  if (envPath) return envPath;

  let dir = startDir;
  const root = parse(dir).root;

  while (true) {
    const candidate = join(dir, "specs.config.json");
    if (fileExists(candidate)) return candidate;
    if (dir === root) break;
    dir = dirname(dir);
  }

  return "specs.config.json";
}
