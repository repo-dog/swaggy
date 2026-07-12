import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../../src/App.js";
import { useStore } from "../../src/store/store.js";
import * as api from "../../src/lib/api.js";

beforeEach(() => { localStorage.clear(); useStore.setState(useStore.getInitialState(), true); vi.clearAllMocks();
  vi.spyOn(api, "getOperations").mockResolvedValue([]);
  vi.spyOn(api, "getSpecs").mockResolvedValue([]);
  document.documentElement.classList.remove("dark");
});

const renderApp = () => render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>);

describe("ThemeToggle", () => {
  it("cycles system → light → dark and applies .dark for dark", async () => {
    renderApp();
    // Default is system; the stubbed OS prefers light, so no .dark initially.
    expect(useStore.getState().theme).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /switch to light mode/i }));
    expect(useStore.getState().theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    expect(useStore.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /switch to system mode/i }));
    expect(useStore.getState().theme).toBe("system");
  });

  it("follows the OS when theme is system", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true, media: "(prefers-color-scheme: dark)", onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
    renderApp();
    expect(useStore.getState().theme).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
