import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomHeaders } from "../../src/features/request/CustomHeaders.js";
import type { CustomHeader } from "../../src/store/store.types.js";

describe("CustomHeaders", () => {
  it("adds a new empty row", async () => {
    const onChange = vi.fn();
    render(<CustomHeaders headers={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add header/i }));
    expect(onChange).toHaveBeenCalledWith([{ name: "", value: "" }]);
  });

  it("edits a row's value", () => {
    const onChange = vi.fn();
    const headers: CustomHeader[] = [{ name: "X-Env", value: "" }];
    render(<CustomHeaders headers={headers} onChange={onChange} />);
    // Controlled input reflects the prop, so drive a single change event.
    fireEvent.change(screen.getByLabelText(/value for x-env/i), { target: { value: "prod" } });
    expect(onChange).toHaveBeenCalledWith([{ name: "X-Env", value: "prod" }]);
  });

  it("deletes a row", async () => {
    const onChange = vi.fn();
    const headers: CustomHeader[] = [{ name: "A", value: "1" }, { name: "B", value: "2" }];
    render(<CustomHeaders headers={headers} onChange={onChange} />);
    await userEvent.click(screen.getAllByRole("button", { name: /remove header/i })[0]);
    expect(onChange).toHaveBeenCalledWith([{ name: "B", value: "2" }]);
  });
});
