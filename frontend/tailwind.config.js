/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        side: "rgb(var(--side) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        mute: "rgb(var(--mute) / <alpha-value>)",
        brand: "#3B82F6", cyan: "#06B6D4", ok: "#22C55E", warn: "#F59E0B", bad: "#EF4444",
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: { glow: "0 0 0 1px rgb(59 130 246 / .35), 0 8px 30px -8px rgb(59 130 246 / .35)" },
    },
  },
  plugins: [],
};
