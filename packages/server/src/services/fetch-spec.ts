import SwaggerParser from "@apidevtools/swagger-parser";

// Accepts a spec URL (string) or an in-memory document; returns it fully dereferenced.
export async function fetchDereferencedSpec(urlOrDoc: string | object): Promise<any> {
  return SwaggerParser.dereference(urlOrDoc as any);
}
