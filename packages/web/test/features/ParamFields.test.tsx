import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParamFields } from "../../src/features/request/ParamFields.js";
import { useStore } from "../../src/store/store.js";
import type { Operation } from "@swaggy/shared";

beforeEach(() => { localStorage.clear(); useStore.setState(useStore.getInitialState(), true); });

const op: Operation = {
  id: "x", specId: "s", specTitle: "S", method: "GET", path: "/u/{id}", summary: "", description: "",
  tags: [], servers: ["https://a"],
  pathParams: [{ name: "id", in: "path", schema: { type: "integer" }, required: true }],
  queryParams: [{ name: "status", in: "query", schema: { type: "string", enum: ["a", "b"] }, required: false }],
  headerParams: [], requestBody: null, responses: [],
};

const inputs = (over: Partial<{ pathParams: Record<string, string>; query: Record<string, string | string[]> }> = {}) => ({
  server: "https://a", pathParams: {}, query: {} as Record<string, string | string[]>, headers: {}, ...over,
});

describe("ParamFields", () => {
  it("renders a dropdown with options for an enum param", () => {
    render(<ParamFields op={op} inputs={inputs()} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "a" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "b" })).toBeInTheDocument();
  });

  it("renders a boolean query param as a true/false select, not a text input", () => {
    const boolOp: Operation = {
      ...op,
      pathParams: [],
      queryParams: [{ name: "active", in: "query", schema: { type: "boolean" }, required: false }],
    };
    render(<ParamFields op={boolOp} inputs={inputs()} onChange={vi.fn()} />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "true" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "false" })).toBeInTheDocument();
    // Not a free-text field.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows an inline error for a present-but-invalid value", () => {
    render(<ParamFields op={op} inputs={inputs({ pathParams: { id: "abc" } })} onChange={vi.fn()} />);
    expect(screen.getByText("must be a number")).toBeInTheDocument();
  });

  it("does not show a redundant 'one of' hint for an enum dropdown", () => {
    render(<ParamFields op={op} inputs={inputs()} onChange={vi.fn()} />);
    // The enum renders as a select that already lists the options.
    expect(screen.queryByText(/one of:/i)).not.toBeInTheDocument();
  });

  it("marks each param as required or optional", () => {
    // op fixture: path param `id` is required, query param `status` is optional.
    render(<ParamFields op={op} inputs={inputs()} onChange={vi.fn()} />);
    expect(screen.getByText("required")).toBeInTheDocument();
    expect(screen.getByText("optional")).toBeInTheDocument();
  });

  it("shows the inherited common header value and notes its source on a header field", () => {
    useStore.getState().setCommonHeaders([{ name: "Authorization", value: "Bearer t" }]);
    const headerOp: Operation = {
      ...op,
      pathParams: [],
      queryParams: [],
      headerParams: [{ name: "Authorization", in: "header", schema: { type: "string" }, required: false }],
    };
    render(<ParamFields op={headerOp} inputs={inputs()} onChange={vi.fn()} />);
    // The actual value shows as the placeholder, with a note explaining it's inherited.
    expect(screen.getByPlaceholderText("Bearer t")).toBeInTheDocument();
    expect(screen.getByText("Inherited from common headers")).toBeInTheDocument();
  });

  it("hides the inherited note once the header field is overridden", () => {
    useStore.getState().setCommonHeaders([{ name: "Authorization", value: "Bearer t" }]);
    const headerOp: Operation = {
      ...op,
      pathParams: [],
      queryParams: [],
      headerParams: [{ name: "Authorization", in: "header", schema: { type: "string" }, required: false }],
    };
    render(<ParamFields op={headerOp} inputs={{ ...inputs(), headers: { Authorization: "Bearer override" } }} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("Bearer override");
    expect(screen.queryByText("Inherited from common headers")).not.toBeInTheDocument();
  });

  it("stops showing the inherited note once the user edits the field, even if left empty", async () => {
    useStore.getState().setCommonHeaders([{ name: "Authorization", value: "Bearer t" }]);
    const headerOp: Operation = {
      ...op,
      pathParams: [],
      queryParams: [],
      headerParams: [{ name: "Authorization", in: "header", schema: { type: "string" }, required: false }],
    };
    render(<ParamFields op={headerOp} inputs={inputs()} onChange={vi.fn()} />);
    expect(screen.getByText("Inherited from common headers")).toBeInTheDocument();
    // Touching the field (even without committing a value) marks it as an explicit override.
    await userEvent.type(screen.getByRole("textbox"), "x");
    expect(screen.queryByText("Inherited from common headers")).not.toBeInTheDocument();
  });

  it("surfaces the param description from the spec", () => {
    const withDesc: Operation = {
      ...op,
      pathParams: [{ name: "id", in: "path", schema: { type: "integer" }, required: true, description: "The user's unique id" }],
    };
    render(<ParamFields op={withDesc} inputs={inputs()} onChange={vi.fn()} />);
    expect(screen.getByText("The user's unique id")).toBeInTheDocument();
  });

  it("fills a field from the spec example on click", async () => {
    const onChange = vi.fn();
    const withExample: Operation = {
      ...op,
      pathParams: [{ name: "id", in: "path", schema: { type: "integer" }, required: true, example: 42 }],
    };
    render(<ParamFields op={withExample} inputs={inputs()} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /example: 42/i }));
    expect(onChange).toHaveBeenCalledWith({ pathParams: { id: "42" } });
  });

  it("drops a scalar field from inputs when cleared, instead of leaving an empty string", async () => {
    const onChange = vi.fn();
    const nullableOp: Operation = {
      ...op,
      queryParams: [{ name: "q", in: "query", schema: { type: ["string", "null"] as unknown as string }, required: false }],
    };
    render(<ParamFields op={nullableOp} inputs={inputs({ query: { q: "abc" } })} onChange={onChange} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("abc");
    await userEvent.clear(input);
    // The key is removed rather than set to "" — the param reverts to "not provided".
    expect(onChange).toHaveBeenCalledWith({ query: {} });
  });

  it("lets you enter multiple values for an array query param", async () => {
    const onChange = vi.fn();
    const arrayOp: Operation = {
      ...op,
      queryParams: [{ name: "tags", in: "query", schema: { type: "array", items: { type: "string" } }, required: false }],
    };
    render(<ParamFields op={arrayOp} inputs={inputs({ query: { tags: ["x"] } })} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add value/i }));
    // A new empty row is appended → the query becomes a two-element array.
    expect(onChange).toHaveBeenCalledWith({ query: { tags: ["x", ""] } });
  });
});

const headerOp: Operation = {
  ...op,
  pathParams: [],
  queryParams: [],
  headerParams: [{ name: "X-Trace", in: "header", schema: { type: "string" }, required: false }],
};
const headerInputs = (value: string) => ({ server: "https://a", pathParams: {}, query: {} as Record<string, string | string[]>, headers: { "X-Trace": value } });
const commonHeadersOf = () => useStore.getState().profiles.find((p) => p.profileId === useStore.getState().activeProfileId)?.commonHeaders ?? [];

describe("ParamFields — save a header to common headers", () => {
  it("adds a header value to the active profile's common headers", async () => {
    render(<ParamFields op={headerOp} inputs={headerInputs("abc123")} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /add to common headers/i }));
    expect(commonHeadersOf()).toEqual([{ name: "X-Trace", value: "abc123" }]);
    expect(screen.getByLabelText(/added to common headers/i)).toBeInTheDocument();
  });

  it("disables the control when the header value is empty", () => {
    render(<ParamFields op={headerOp} inputs={headerInputs("")} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add to common headers/i })).toBeDisabled();
  });

  it("prompts to replace when a common header of the same name already exists", async () => {
    useStore.getState().setCommonHeaders([{ name: "X-Trace", value: "old" }]);
    render(<ParamFields op={headerOp} inputs={headerInputs("new")} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /add to common headers/i }));
    // The confirm appears (Replace/Cancel) and nothing is overwritten until Replace is chosen.
    expect(screen.getByRole("button", { name: /^replace$/i })).toBeInTheDocument();
    expect(commonHeadersOf()).toEqual([{ name: "X-Trace", value: "old" }]);

    await userEvent.click(screen.getByRole("button", { name: /^replace$/i }));
    expect(commonHeadersOf()).toEqual([{ name: "X-Trace", value: "new" }]);
  });

  it("cancels the replace without changing anything", async () => {
    useStore.getState().setCommonHeaders([{ name: "X-Trace", value: "old" }]);
    render(<ParamFields op={headerOp} inputs={headerInputs("new")} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /add to common headers/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(commonHeadersOf()).toEqual([{ name: "X-Trace", value: "old" }]);
  });
});
