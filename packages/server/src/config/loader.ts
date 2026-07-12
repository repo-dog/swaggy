import { readFileSync } from "node:fs";
import { ConfigSchema, type Config } from "@swaggy/shared";

export function loadConfig(filePath: string): Config {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (e) {
    throw new Error(`Could not read config file at ${filePath}: ${(e as Error).message}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Config file ${filePath} is not valid JSON: ${(e as Error).message}`);
  }

  const parsed = ConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Invalid config: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }

  const names = new Set<string>();
  for (const spec of parsed.data.specs) {
    if (names.has(spec.name)) {
      throw new Error(`Duplicate spec name in config: "${spec.name}"`);
    }
    names.add(spec.name);
  }

  return parsed.data;
}
