import { describe, it, expect } from "vitest";
import { fetchDereferencedSpec } from "../../src/services/fetch-spec.js";

describe("fetchDereferencedSpec", () => {
  it("dereferences a local spec object passed as a data URL-like path", async () => {
    // SwaggerParser.dereference accepts an in-memory object too.
    const doc = {
      openapi: "3.0.0", info: { title: "T", version: "1" },
      components: { schemas: { Id: { type: "string" } } },
      paths: { "/x": { get: { responses: { "200": { content: { "application/json": { schema: { $ref: "#/components/schemas/Id" } } } } } } } },
    };
    const out = await fetchDereferencedSpec(doc as any);
    const schema = out.paths["/x"].get.responses["200"].content["application/json"].schema;
    expect(schema).toEqual({ type: "string" }); // $ref resolved
  });
});
