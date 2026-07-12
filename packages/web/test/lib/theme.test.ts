import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveTheme, nextTheme, systemPrefersDark, onSystemThemeChange } from "../../src/lib/theme.js";

const mockMatchMedia = (matches: boolean, on?: { add: () => void; remove: () => void }) =>
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches, media: "(prefers-color-scheme: dark)", onchange: null,
    addEventListener: on?.add ?? (() => {}), removeEventListener: on?.remove ?? (() => {}),
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  } as unknown as MediaQueryList);

afterEach(() => vi.restoreAllMocks());

describe("nextTheme", () => {
  it("cycles system → light → dark → system", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("passes explicit themes through unchanged", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });
  it("resolves system against the OS preference", () => {
    mockMatchMedia(true);
    expect(resolveTheme("system")).toBe("dark");
    expect(systemPrefersDark()).toBe(true);
  });
  it("resolves system to light when the OS prefers light", () => {
    mockMatchMedia(false);
    expect(resolveTheme("system")).toBe("light");
  });
});

describe("onSystemThemeChange", () => {
  it("subscribes and unsubscribes to the media query", () => {
    const add = vi.fn();
    const remove = vi.fn();
    mockMatchMedia(false, { add, remove });
    const off = onSystemThemeChange(() => {});
    expect(add).toHaveBeenCalledOnce();
    off();
    expect(remove).toHaveBeenCalledOnce();
  });
});
