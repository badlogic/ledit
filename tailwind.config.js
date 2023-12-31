/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./site/*.{html,ts}", "./site/sources/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        background: "rgba(var(--background), <alpha-value>)",
        color: "rgba(var(--color), <alpha-value>)",
        border: "rgba(var(--border), <alpha-value>)",
        primary: "rgba(var(--primary), <alpha-value>)",
        "on-primary": "rgba(var(--on-primary), <alpha-value>)",
        surface: "rgba(var(--surface), <alpha-value>)",
        "surface-dim": "rgba(var(--surface-dim), <alpha-value>)",
      },
    },
  },
  darkMode: ['class', 'dark-theme'],
  plugins: [],
}