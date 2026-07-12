import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "../../src/features/common/Markdown.js";

describe("Markdown", () => {
  it("renders nothing for empty/absent input", () => {
    const { container } = render(<Markdown>{undefined}</Markdown>);
    expect(container).toBeEmptyDOMElement();
    const { container: c2 } = render(<Markdown>{"   "}</Markdown>);
    expect(c2).toBeEmptyDOMElement();
  });

  it("renders plain text unchanged", () => {
    render(<Markdown>Just a description.</Markdown>);
    expect(screen.getByText("Just a description.")).toBeInTheDocument();
  });

  it("renders emphasis, inline code, and links (links open in a new tab)", () => {
    render(<Markdown>{"Use `id` and see **docs** at [here](https://x.test)."}</Markdown>);
    expect(screen.getByText("id").tagName).toBe("CODE");
    expect(screen.getByText("docs").tagName).toBe("STRONG");
    const link = screen.getByRole("link", { name: "here" });
    expect(link).toHaveAttribute("href", "https://x.test");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders GFM lists", () => {
    render(<Markdown>{"- one\n- two"}</Markdown>);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
