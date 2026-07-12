import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportProfilesButton } from "../../src/features/profiles/ExportProfilesButton.js";
import { useStore } from "../../src/store/store.js";
import type { Profile } from "../../src/store/store.types.js";

const downloadJson = vi.fn();
vi.mock("../../src/lib/download.js", () => ({ downloadJson: (...args: unknown[]) => downloadJson(...args) }));

const profiles: Profile[] = [
  { profileId: "default", name: "Default", operationIds: ["a"], commonHeaders: [], variables: {}, history: [] },
  { profileId: "p2", name: "Staging", operationIds: ["b"], commonHeaders: [], variables: {}, history: [] },
];

beforeEach(() => {
  localStorage.clear();
  useStore.setState(useStore.getInitialState(), true);
  useStore.setState({ profiles, activeProfileId: "default" });
  downloadJson.mockClear();
});

describe("ExportProfilesButton", () => {
  it("opens a popover listing all profiles, selected by default", async () => {
    render(<ExportProfilesButton />);
    await userEvent.click(screen.getByLabelText("Export profiles"));
    const boxes = screen.getAllByRole("checkbox");
    // Select-all + one per profile, all checked.
    expect(boxes).toHaveLength(3);
    expect(boxes.every((b) => (b as HTMLInputElement).checked)).toBe(true);
  });

  it("downloads only the selected profiles", async () => {
    render(<ExportProfilesButton />);
    await userEvent.click(screen.getByLabelText("Export profiles"));
    // Deselect "Staging", leaving only Default.
    await userEvent.click(screen.getByLabelText("Staging"));
    await userEvent.click(screen.getByRole("button", { name: /Download/ }));
    expect(downloadJson).toHaveBeenCalledTimes(1);
    const [filename, envelope] = downloadJson.mock.calls[0];
    expect(filename).toBe("swaggy-profile-default-" + new Date().toISOString().slice(0, 10) + ".json");
    expect(envelope.profiles.map((p: Profile) => p.name)).toEqual(["Default"]);
    expect("history" in envelope.profiles[0]).toBe(false);
  });

  it("disables Download when nothing is selected", async () => {
    render(<ExportProfilesButton />);
    await userEvent.click(screen.getByLabelText("Export profiles"));
    await userEvent.click(screen.getByLabelText("Select all")); // toggles all off (were all on)
    expect(screen.getByRole("button", { name: /Download/ })).toBeDisabled();
  });
});
