import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic tokens, backed by CSS variables so light/dark switch in one place.
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          strong: "rgb(var(--brand-strong) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
        },
        beacon: {
          DEFAULT: "rgb(var(--beacon) / <alpha-value>)",
          soft: "rgb(var(--beacon-soft) / <alpha-value>)",
        },
        ok: { DEFAULT: "rgb(var(--ok) / <alpha-value>)", soft: "rgb(var(--ok-soft) / <alpha-value>)" },
        warn: { DEFAULT: "rgb(var(--warn) / <alpha-value>)", soft: "rgb(var(--warn-soft) / <alpha-value>)" },
        bad: { DEFAULT: "rgb(var(--bad) / <alpha-value>)", soft: "rgb(var(--bad-soft) / <alpha-value>)" },
        rail: {
          DEFAULT: "rgb(var(--rail) / <alpha-value>)",
          hover: "rgb(var(--rail-hover) / <alpha-value>)",
          text: "rgb(var(--rail-text) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { card: "12px", control: "8px" },
      boxShadow: {
        card: "0 1px 0 rgb(var(--line) / 0.6), 0 1px 2px rgb(15 23 42 / 0.04)",
        pop: "0 12px 32px -8px rgb(15 23 42 / 0.28), 0 2px 6px rgb(15 23 42 / 0.08)",
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        pop: { from: { opacity: "0", transform: "scale(.97) translateY(-4px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        lane: { to: { backgroundPosition: "-48px 0" } },
      },
      animation: {
        rise: "rise .35s cubic-bezier(.2,.7,.2,1) both",
        pop: "pop .14s ease-out both",
        lane: "lane 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
