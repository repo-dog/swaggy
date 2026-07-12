import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileSwitcher } from "../../src/features/profiles/ProfileSwitcher.js";
import { useStore } from "../../src/store/store.js";

beforeEach(() => { localStorage.clear(); useStore.setState(useStore.getInitialState(), true); });

describe("ProfileSwitcher", () => {
  it("offers a '+ New profile' option inside the dropdown", () => {
    render(<ProfileSwitcher />);
    expect(screen.getByRole("option", { name: /new profile/i })).toBeInTheDocument();
    // No standalone button — creation lives in the dropdown now.
    expect(screen.queryByRole("button", { name: /new profile/i })).not.toBeInTheDocument();
  });

  it("creates a new profile via the dropdown and makes it active", async () => {
    render(<ProfileSwitcher />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "__new__");
    await userEvent.type(screen.getByPlaceholderText(/profile name/i), "task-1");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(useStore.getState().profiles.some((p) => p.name === "task-1")).toBe(true);
    expect(useStore.getState().activeProfileId).not.toBe("default");
  });

  it("cancels creation without adding a profile", async () => {
    render(<ProfileSwitcher />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "__new__");
    await userEvent.type(screen.getByPlaceholderText(/profile name/i), "scratch");
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(useStore.getState().profiles).toHaveLength(1);
    expect(screen.queryByPlaceholderText(/profile name/i)).not.toBeInTheDocument();
  });

  it("offers no delete affordance for the default profile", () => {
    render(<ProfileSwitcher />); // default profile is active
    expect(screen.queryByRole("button", { name: /delete profile/i })).not.toBeInTheDocument();
  });

  it("deletes a non-default profile after confirming, falling back to default", async () => {
    const id = useStore.getState().createProfile("task-1"); // becomes active
    render(<ProfileSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: /delete profile task-1/i }));
    // Confirmation step — nothing removed yet.
    expect(useStore.getState().profiles.some((p) => p.profileId === id)).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(useStore.getState().profiles.some((p) => p.profileId === id)).toBe(false);
    expect(useStore.getState().activeProfileId).toBe("default");
  });

  it("does not delete when the confirmation is cancelled", async () => {
    useStore.getState().createProfile("keep-me");
    render(<ProfileSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: /delete profile keep-me/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(useStore.getState().profiles.some((p) => p.name === "keep-me")).toBe(true);
  });
});
