import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportProfilesButton } from "../../src/features/profiles/ImportProfilesButton.js";
import { useStore } from "../../src/store/store.js";
import { buildProfileExport } from "../../src/features/profiles/profileExport.js";

beforeEach(() => {
  localStorage.clear();
  useStore.setState(useStore.getInitialState(), true);
});

const upload = (obj: unknown) => {
  const file = new File([JSON.stringify(obj)], "profiles.json", { type: "application/json" });
  fireEvent.change(screen.getByLabelText("Profiles file"), { target: { files: [file] } });
};

describe("ImportProfilesButton", () => {
  it("imports profiles from a valid export file and appends them", async () => {
    const env = buildProfileExport(
      [{ profileId: "p2", name: "Staging", operationIds: ["a"], commonHeaders: [], variables: {}, history: [] }],
      ["p2"],
    );
    render(<ImportProfilesButton />);
    upload(env);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/imported 1 profile/i));
    expect(useStore.getState().profiles.map((p) => p.name)).toContain("Staging");
  });

  it("reports an error for an unrecognized file", async () => {
    render(<ImportProfilesButton />);
    upload({ kind: "not.swaggy" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Swaggy profiles export/i));
    // Nothing added beyond the default profile.
    expect(useStore.getState().profiles).toHaveLength(1);
  });
});
