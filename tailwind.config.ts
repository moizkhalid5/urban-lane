import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium, minimal palette: white bg, near-black text, light grey borders.
        ink: {
          DEFAULT: "#111111",
          soft: "#3a3a3a",
          muted: "#6b6b6b",
        },
        line: {
          DEFAULT: "#e7e7e7",
          soft: "#f1f1f1",
        },
        sale: "#b4232a",
        success: "#1a7f4b",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      maxWidth: {
        site: "1440px",
      },
      spacing: {
        "site-x": "clamp(1rem, 4vw, 4rem)",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "drawer-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s var(--tw-ease, ease) both",
        "drawer-in": "drawer-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
