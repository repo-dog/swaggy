import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResponseViewer } from "../../src/features/response/ResponseViewer.js";

const writeText = vi.fn();
beforeEach(() => {
  writeText.mockReset();
  Object.assign(navigator, { clipboard: { writeText } });
});

const okResult = {
  ok: true as const,
  response: { status: 200, statusText: "OK", headers: {}, body: { id: 1, name: "a" }, durationMs: 5, bodySize: 20 },
};

const withResponse = (over: Partial<typeof okResult.response>) => ({
  ok: true as const,
  response: { ...okResult.response, ...over },
});

describe("ResponseViewer", () => {
  it("renders a JSON body as an interactive tree with copyable values", async () => {
    render(<ResponseViewer result={okResult} curl="curl https://x" />);
    expect(screen.getByText("name:")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy name" }));
    expect(writeText).toHaveBeenCalledWith("a");
  });

  it("labels the status, time and size stats", () => {
    render(<ResponseViewer result={okResult} curl="curl https://x" />);
    expect(screen.getByText(/Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Time/i)).toBeInTheDocument();
    expect(screen.getByText(/Size/i)).toBeInTheDocument();
    expect(screen.getByText(/200 OK/)).toBeInTheDocument();
  });

  it("shows a Content-Type stat with the charset stripped", () => {
    render(<ResponseViewer result={withResponse({ headers: { "content-type": "application/json; charset=utf-8" } })} curl="c" />);
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("application/json")).toBeInTheDocument();
  });

  it("surfaces a Location header as a banner", () => {
    render(<ResponseViewer result={withResponse({ status: 201, headers: { location: "https://api/x/1" } })} curl="c" />);
    expect(screen.getByText(/Location:/)).toBeInTheDocument();
    expect(screen.getByText("https://api/x/1")).toBeInTheDocument();
  });

  it("captures a value from the tree as a named variable", async () => {
    const onCaptureVariable = vi.fn();
    render(<ResponseViewer result={okResult} curl="c" onCaptureVariable={onCaptureVariable} />);
    // Capture the `name` leaf ("a"), which pre-fills the suggested name.
    await userEvent.click(screen.getByRole("button", { name: /save name as variable/i }));
    const nameInput = screen.getByLabelText(/variable name/i);
    expect(nameInput).toHaveValue("name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "userName");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onCaptureVariable).toHaveBeenCalledWith("userName", "a");
  });

  it("warns and offers Replace when the variable name already exists", async () => {
    const onCaptureVariable = vi.fn();
    render(<ResponseViewer result={okResult} curl="c" onCaptureVariable={onCaptureVariable} existingVariableNames={["name"]} />);
    // Capturing the `name` leaf pre-fills "name", which collides with an existing variable.
    await userEvent.click(screen.getByRole("button", { name: /save name as variable/i }));
    expect(screen.getByLabelText(/variable name/i)).toHaveValue("name");
    // Save is replaced by Replace, and a hint explains the two options.
    expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(screen.getByText(/choose a new name, or Replace/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^replace$/i }));
    expect(onCaptureVariable).toHaveBeenCalledWith("name", "a");
  });

  it("shows Save (not Replace) once the name no longer collides", async () => {
    const onCaptureVariable = vi.fn();
    render(<ResponseViewer result={okResult} curl="c" onCaptureVariable={onCaptureVariable} existingVariableNames={["name"]} />);
    await userEvent.click(screen.getByRole("button", { name: /save name as variable/i }));
    const nameInput = screen.getByLabelText(/variable name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "fresh");
    expect(screen.queryByRole("button", { name: /^replace$/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onCaptureVariable).toHaveBeenCalledWith("fresh", "a");
  });

  it("shows no capture affordance without onCaptureVariable", () => {
    render(<ResponseViewer result={okResult} curl="c" />);
    expect(screen.queryByRole("button", { name: /save .* as variable/i })).not.toBeInTheDocument();
  });

  it("shows a hint when the response body is empty (e.g. 204)", () => {
    const result = { ok: true as const, response: { status: 204, statusText: "No Content", headers: {}, body: "", durationMs: 1, bodySize: 0 } };
    render(<ResponseViewer result={result} curl="c" />);
    expect(screen.getByText(/no response body/i)).toBeInTheDocument();
  });

  it("downloads the response body", async () => {
    const createObjectURL = vi.fn(() => "blob:x");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ResponseViewer result={okResult} curl="c" />);
    await userEvent.click(screen.getByRole("button", { name: /download response body/i }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
