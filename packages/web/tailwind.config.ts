import type { Config } from "tailwindcss";

/** A semantic color backed by a CSS variable, with Tailwind opacity support. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Semantic color tokens backed by CSS variables (see src/index.css, the single source
      // of truth). Using `rgb(var(--x) / <alpha-value>)` keeps `/opacity` utilities working.
      colors: {
        canvas: token("canvas"),
        surface: { DEFAULT: token("surface"), muted: token("surface-muted"), code: token("surface-code") },
        content: {
          DEFAULT: token("content"),
          secondary: token("content-secondary"),
          muted: token("content-muted"),
          faint: token("content-faint"),
          inverse: token("content-inverse"),
        },
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        accent: {
          DEFAULT: token("accent"),
          strong: token("accent-strong"),
          subtle: token("accent-subtle"),
          contrast: token("accent-contrast"),
        },
        danger: { DEFAULT: token("danger"), strong: token("danger-strong"), subtle: token("danger-subtle") },
        warning: { DEFAULT: token("warning"), subtle: token("warning-subtle") },
        success: token("success"),
        method: {
          get: token("method-get"),
          post: token("method-post"),
          put: token("method-put"),
          patch: token("method-patch"),
          delete: token("method-delete"),
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
