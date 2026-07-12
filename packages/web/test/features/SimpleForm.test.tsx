import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimpleForm } from "../../src/features/request/SimpleForm.js";
import { initialInputsFor } from "../../src/features/request/initialInputs.js";
import type { Operation } from "@swaggy/shared";

const base: Operation = {
  id: "x", specId: "s", specTitle: "S", method: "POST", path: "/x", summary: "", description: "",
  tags: [], servers: ["https://a"], pathParams: [], queryParams: [], headerParams: [],
  requestBody: { contentType: "application/json", jsonSchema: { type: "object", properties: { name: { type: "string", title: "Name" } } } },
  responses: [],
};

describe("SimpleForm", () => {
  it("renders a labeled field for a supported schema", () => {
    render(<SimpleForm op={base} inputs={{ server: "https://a", pathParams: {}, query: {}, headers: {}, body: {} }} onChange={vi.fn()} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("surfaces required/optional and descriptions for body fields (no redundant enum hint)", () => {
    const op: Operation = {
      ...base,
      requestBody: {
        contentType: "application/json",
        jsonSchema: {
          type: "object",
          required: ["role"],
          properties: {
            role: { type: "string", title: "Role", enum: ["admin", "user"], description: "The account role" },
            nickname: { type: "string", title: "Nickname" },
          },
        },
      },
    };
    render(<SimpleForm op={op} inputs={{ server: "https://a", pathParams: {}, query: {}, headers: {}, body: {} }} onChange={vi.fn()} />);
    expect(screen.getAllByText("The account role").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("required")).toBeInTheDocument(); // role
    expect(screen.getByText("optional")).toBeInTheDocument(); // nickname
    // The enum renders as a dropdown, so no "one of" hint is shown.
    expect(screen.queryByText(/one of:/i)).not.toBeInTheDocument();
  });

  it("renders array fields with a visible add control", async () => {
    const op: Operation = {
      ...base,
      requestBody: {
        contentType: "application/json",
        jsonSchema: {
          type: "object",
          properties: {
            additionalNationalities: { type: "array", title: "Additional nationalities", items: { type: "string", enum: ["DE", "FR"] } },
          },
        },
      },
    };
    render(<SimpleForm op={op} inputs={{ server: "https://a", pathParams: {}, query: {}, headers: {}, body: {} }} onChange={vi.fn()} />);
    const add = screen.getByRole("button", { name: /add item/i });
    expect(add).toBeInTheDocument();
    // Adding an item reveals its editable control (a select for the enum items).
    await userEvent.click(add);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("doesn't flag untouched optional fields — the seeded body has no fabricated values", () => {
    const op: Operation = {
      ...base,
      requestBody: {
        contentType: "application/json",
        jsonSchema: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["admin", "user"] }, // optional enum
            count: { type: "integer", minimum: 1 }, // optional, constrained
          },
        },
      },
    };
    // Use the real seeding path — previously it filled ""/0, tripping validation.
    render(<SimpleForm op={op} inputs={initialInputsFor(op)} onChange={vi.fn()} />);
    expect(screen.queryByText(/allowed values/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/must be/i)).not.toBeInTheDocument();
  });

  it("doesn't flag an optional nested object's required children while untouched", () => {
    const op: Operation = {
      ...base,
      requestBody: {
        contentType: "application/json",
        jsonSchema: {
          type: "object",
          properties: {
            // `address` is optional, but has a required child. It must not be pre-seeded
            // as {} or its 'country' requirement fires before the user opens it.
            address: { type: "object", required: ["country"], properties: { country: { type: "string" }, city: { type: "string" } } },
          },
        },
      },
    };
    render(<SimpleForm op={op} inputs={initialInputsFor(op)} onChange={vi.fn()} />);
    expect(screen.queryByText(/required property/i)).not.toBeInTheDocument();
  });

  it("renders a nested object expanded by default and lets it collapse", async () => {
    const op: Operation = {
      ...base,
      requestBody: {
        contentType: "application/json",
        jsonSchema: {
          type: "object",
          properties: {
            address: { type: "object", title: "Address", properties: { city: { type: "string", title: "City" } } },
          },
        },
      },
    };
    render(<SimpleForm op={op} inputs={{ server: "https://a", pathParams: {}, query: {}, headers: {}, body: {} }} onChange={vi.fn()} />);
    // Expanded by default — the nested field is visible.
    expect(screen.getByText("City")).toBeInTheDocument();
    // Collapse via the object's header toggle.
    await userEvent.click(screen.getByRole("button", { name: /address/i }));
    expect(screen.queryByText("City")).not.toBeInTheDocument();
  });

  it("degrades oneOf schemas to a raw JSON field", () => {
    const op = { ...base, requestBody: { contentType: "application/json", jsonSchema: { oneOf: [{ type: "string" }] } } };
    render(<SimpleForm op={op} inputs={{ server: "https://a", pathParams: {}, query: {}, headers: {}, body: {} }} onChange={vi.fn()} />);
    expect(screen.getByText(/complex schema/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does not validate an untouched body on first load", () => {
    const op: Operation = {
      ...base,
      requestBody: {
        contentType: "application/json",
        jsonSchema: { type: "object", required: ["name"], properties: { name: { type: "string", title: "Name" } } },
      },
    };
    // Even a missing required field must NOT complain until the user interacts.
    render(<SimpleForm op={op} inputs={{ server: "https://a", pathParams: {}, query: {}, headers: {}, body: {} }} onChange={vi.fn()} />);
    expect(screen.queryByText(/required property/i)).not.toBeInTheDocument();
  });

  it("does not carry validation over to the next operation opened", async () => {
    const bodyOp = (id: string): Operation => ({
      ...base,
      id,
      path: `/${id}`,
      requestBody: {
        contentType: "application/json",
        jsonSchema: { type: "object", required: ["role"], properties: { role: { type: "string", enum: ["a", "b"], title: "Role" } } },
      },
    });
    const inputs = { server: "https://a", pathParams: {}, query: {}, headers: {}, body: {} };
    const { rerender } = render(<SimpleForm op={bodyOp("opA")} inputs={inputs} onChange={vi.fn()} />);
    // Interact with op A's dropdown → its validation turns on.
    await userEvent.selectOptions(screen.getByRole("combobox"), "a");
    // Switching to another operation (same reused component) must reset the gate.
    rerender(<SimpleForm op={bodyOp("opB")} inputs={inputs} onChange={vi.fn()} />);
    expect(screen.queryByText(/required property/i)).not.toBeInTheDocument();
  });

  it("live-validates once the user edits the body", async () => {
    const op: Operation = {
      ...base,
      requestBody: {
        contentType: "application/json",
        jsonSchema: { type: "object", required: ["name"], properties: { name: { type: "string", title: "Name" } } },
      },
    };
    render(<SimpleForm op={op} inputs={{ server: "https://a", pathParams: {}, query: {}, headers: {}, body: {} }} onChange={vi.fn()} />);
    const box = screen.getByRole("textbox");
    // Type then clear → the field is touched but still empty, so the requirement now shows.
    await userEvent.type(box, "a");
    await userEvent.clear(box);
    expect(await screen.findByText(/required property/i)).toBeInTheDocument();
  });
});
