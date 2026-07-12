import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvancedBody } from "../../src/features/request/AdvancedBody.js";
import { useStore } from "../../src/store/store.js";
import type { Operation } from "@swaggy/shared";

const op: Operation = {
  id: "x", specId: "s", specTitle: "S", method: "POST", path: "/x", summary: "", description: "",
  tags: [], servers: ["https://a"], pathParams: [], queryParams: [], headerParams: [],
  requestBody: { contentType: "application/json", jsonSchema: { type: "object", properties: { name: { type: "string" }, nickname: { type: "string" } } } },
  responses: [],
};
const inputs = (body?: unknown) => ({ server: "https://a", pathParams: {}, query: {}, headers: {}, body });

beforeEach(() => { localStorage.clear(); useStore.setState(useStore.getInitialState(), true); });

describe("AdvancedBody", () => {
  it("shows a full skeleton (incl. optional fields) as a template when the body is untouched", () => {
    const { container } = render(<AdvancedBody op={op} inputs={inputs(undefined)} onChange={vi.fn()} />);
    // Both the required-less fields render in the editor — the optional `nickname` included.
    expect(container.textContent).toContain("name");
    expect(container.textContent).toContain("nickname");
  });

  it("still shows the skeleton for an empty {} body (as left by Simple mode)", () => {
    const { container } = render(<AdvancedBody op={op} inputs={inputs({})} onChange={vi.fn()} />);
    expect(container.textContent).toContain("nickname");
  });

  it("shows the full skeleton (all fields) when the body only holds the schema-seeded default", () => {
    // Jarvis POST /globalcontacts/sync: synchronizationType declares a default, so the seeded
    // body is the partial { synchronizationType: "full" }. The editor must still show every
    // field, not just that one.
    const seeded: Operation = {
      ...op,
      requestBody: {
        contentType: "application/json",
        jsonSchema: {
          type: "object",
          properties: {
            synchronizationType: { type: "string", enum: ["full", "delta"], default: "full" },
            since: { type: "string" },
            batchSize: { type: "integer" },
          },
        },
      },
    };
    // The body as initialInputsFor would seed it: only the field with a declared default.
    const { container } = render(<AdvancedBody op={seeded} inputs={inputs({ synchronizationType: "full" })} onChange={vi.fn()} />);
    const editorText = container.querySelector(".cm-content")?.textContent ?? "";
    expect(editorText).toContain("since");
    expect(editorText).toContain("batchSize");
    expect(editorText).toContain("synchronizationType");
  });

  it("shows the actual body once one exists", () => {
    const { container } = render(<AdvancedBody op={op} inputs={inputs({ name: "Ada" })} onChange={vi.fn()} />);
    expect(container.textContent).toContain("Ada");
  });

  it("shows a schema reference beside the editor, collapsible horizontally", async () => {
    render(<AdvancedBody op={op} inputs={inputs(undefined)} onChange={vi.fn()} />);
    // Open by default: the outline renders per-field status pills (unique to it — the JSON
    // editor beside it never contains the word "optional").
    expect(screen.getByText("Schema")).toBeInTheDocument();
    expect(screen.getAllByText("optional").length).toBeGreaterThan(0);
    // Collapsing hides the outline; an expand control remains.
    await userEvent.click(screen.getByLabelText("Collapse schema reference"));
    expect(screen.queryByText("optional")).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Expand schema reference"));
    expect(screen.getAllByText("optional").length).toBeGreaterThan(0);
  });
});
