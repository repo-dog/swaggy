import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServerSelect, substituteServerUrl } from "../../src/features/request/ServerSelect.js";
import type { ServerDef } from "@swaggy/shared";

const def: ServerDef = {
  url: "https://{host}.example.com/{basePath}",
  variables: { host: { default: "api", enum: ["api", "staging"] }, basePath: { default: "v2" } },
};

describe("substituteServerUrl", () => {
  it("fills placeholders from values, falling back to defaults", () => {
    expect(substituteServerUrl(def.url, def, {})).toBe("https://api.example.com/v2");
    expect(substituteServerUrl(def.url, def, { host: "staging" })).toBe("https://staging.example.com/v2");
  });
});

describe("ServerSelect with server variables", () => {
  it("renders a control per variable and rebuilds the URL on change", async () => {
    const onChange = vi.fn();
    render(<ServerSelect servers={["https://api.example.com/v2"]} value="https://api.example.com/v2" onChange={onChange} serverDefs={[def]} />);
    // enum variable → dropdown; pick "staging".
    await userEvent.selectOptions(screen.getByLabelText("host"), "staging");
    expect(onChange).toHaveBeenCalledWith("https://staging.example.com/v2");
  });

  it("falls back to a plain chip when there are no server variables", () => {
    render(<ServerSelect servers={["https://api.example.com"]} value="https://api.example.com" onChange={vi.fn()} />);
    expect(screen.getByText("https://api.example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("host")).not.toBeInTheDocument();
  });
});
