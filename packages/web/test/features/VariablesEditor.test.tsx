import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VariablesEditor } from "../../src/features/profiles/VariablesEditor.js";
import { useStore } from "../../src/store/store.js";

const activeVars = () => useStore.getState().profiles.find((p) => p.profileId === useStore.getState().activeProfileId)!.variables;

beforeEach(() => { localStorage.clear(); useStore.setState(useStore.getInitialState(), true); });

describe("VariablesEditor", () => {
  it("adds a variable to the active profile", async () => {
    render(<VariablesEditor />);
    await userEvent.type(screen.getByPlaceholderText("name"), "token");
    await userEvent.type(screen.getByPlaceholderText("value"), "abc");
    expect(activeVars()).toEqual({ token: "abc" });
  });

  it("renders existing variables and deletes one", async () => {
    useStore.getState().setVariables({ a: "1", b: "2" });
    render(<VariablesEditor />);
    await userEvent.click(screen.getByRole("button", { name: /remove variable a/i }));
    expect(activeVars()).toEqual({ b: "2" });
  });

  it("reflects a variable captured elsewhere live, without a reopen", async () => {
    render(<VariablesEditor />);
    // Simulate capturing a value from a response while the editor is open.
    act(() => { useStore.getState().setVariable("token", "abc"); });
    expect(await screen.findByDisplayValue("token")).toBeInTheDocument();
    expect(screen.getByDisplayValue("abc")).toBeInTheDocument();
  });

  it("updates a shown variable's value when it changes externally", async () => {
    useStore.getState().setVariables({ token: "old" });
    render(<VariablesEditor />);
    expect(screen.getByDisplayValue("old")).toBeInTheDocument();
    act(() => { useStore.getState().setVariable("token", "new"); });
    expect(await screen.findByDisplayValue("new")).toBeInTheDocument();
  });

  it("flags a duplicate variable name", async () => {
    useStore.getState().setVariables({ token: "1" });
    render(<VariablesEditor />);
    // Add a second row and name it the same as the first.
    await userEvent.click(screen.getByRole("button", { name: /add variable/i }));
    const nameInputs = screen.getAllByPlaceholderText("name");
    await userEvent.type(nameInputs[nameInputs.length - 1], "token");
    // Both rows collide, so the warning renders for each.
    expect((await screen.findAllByText(/duplicate variable name/i)).length).toBeGreaterThanOrEqual(1);
  });

  it("copies a variable's key as a ready-to-use {{reference}}", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    useStore.getState().setVariables({ abc: "1" });
    render(<VariablesEditor />);
    await userEvent.click(screen.getByRole("button", { name: "Copy {{abc}}" }));
    expect(writeText).toHaveBeenCalledWith("{{abc}}");
  });
});
