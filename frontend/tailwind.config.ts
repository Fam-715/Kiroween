import type { Config } from "tailwindcss";

// Theme tokens live here. Components must use these, never inline hex colours.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tape: {
          body: "#1c1a1f",
          label: "#e8dcc0",
          accent: "#d9531e",
        },
        condition: {
          mint: "#5fd4a0",
          worn: "#d9c25f",
          warped: "#d98a3d",
          haunted: "#9b6bd6",
          dead: "#5a5560",
        },
        ink: "#f2ead8",
        void: "#0e0c10",
      },
      fontFamily: {
        display: ["'Courier New'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
