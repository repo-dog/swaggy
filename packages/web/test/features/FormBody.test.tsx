import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormBody } from "../../src/features/request/FormBody.js";
import { initialFormParts } from "../../src/features/request/formModel.js";
import type { Operation } from "@swaggy/shared";

const op = (contentType: string): Operation =>
  ({
    id: "files:upload", specId: "s", operationId: "upload", method: "POST", path: "/upload",
    summary: "", tags: [], pathParams: [], queryParams: [], headerParams: [],
    requestBody: {
      contentType,
      jsonSchema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" }, note: { type: "string" } } },
    },
    responses: [], servers: ["https://x"],
  }) as unknown as Operation;

describe("FormBody", () => {
  it("renders a file picker for binary fields and a text input for others (multipart)", () => {
    const o = op("multipart/form-data");
    render(<FormBody op={o} parts={initialFormParts(o)} onChange={() => {}} />);
    expect(screen.getByLabelText(/file for file/i)).toHaveAttribute("type", "file");
    expect(screen.getByLabelText(/value for note/i)).toBeInTheDocument();
  });

  it("offers no file option for urlencoded", () => {
    const o = op("application/x-www-form-urlencoded");
    render(<FormBody op={o} parts={initialFormParts(o)} onChange={() => {}} />);
    expect(screen.queryByLabelText(/type for/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/file for/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/value for file/i)).toBeInTheDocument();
  });

  it("adds an ad-hoc (non-schema) row", async () => {
    const o = op("multipart/form-data");
    const parts = initialFormParts(o);
    const onChange = vi.fn();
    render(<FormBody op={o} parts={parts} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add field/i }));
    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(parts.length + 1);
    expect(next[next.length - 1].fromSchema).toBe(false);
  });
});
