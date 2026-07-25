import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        inter: ["var(--font-inter)", "sans-serif"],
      },
      colors: {
        background: "#0F172A",
        surface: "#111827",
        card: "#1E293B",
        border: "#334155",
        accent: {
          DEFAULT: "#3B82F6",
          secondary: "#8B5CF6",
        },
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        text: {
          primary: "#F8FAFC",
          secondary: "#94A3B8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
