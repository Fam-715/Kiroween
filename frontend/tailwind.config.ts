import type { Config } from "tailwindcss";

// Theme tokens for Cursed Cassette. Components must use these, never inline hex colours.
// Palette (design system): dark plum/black background, off-white cassette plastic,
// orange and teal labels, LCD green digits, condition colours, danger red for Dead only.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Page and panel backgrounds: near-black plum, dark raised plum.
        plum: {
          950: "#1A1220",
          900: "#241A2E",
          800: "#2F2440",
        },
        // Cassette body: off-white plastic, worn edges.
        plastic: {
          100: "#EDE6D6",
          300: "#D9CFBA",
          500: "#B8AC93",
        },
        // Label accents: orange = Side A / primary, teal = Side B / secondary.
        // The "bright" variants are for text on dark backgrounds (WCAG AA).
        label: {
          orange: "#E8722C",
          orangeBright: "#F5935C",
          teal: "#2C8C8C",
          tealBright: "#5FBDBD",
        },
        // LCD digits, countdown, strength readouts.
        lcd: {
          green: "#7DF07D",
          dim: "#3F5C3F",
        },
        // Danger only: Dead condition and destructive actions. Never the only signal.
        danger: "#8A0B0B",
        // Tape condition colours (text always accompanies them).
        condition: {
          mint: "#5FD4A0",
          worn: "#D9C25F",
          warped: "#D98A3D",
          haunted: "#9B6BD6",
          dead: "#8A0B0B",
        },
        // Legacy aliases kept for early scaffold code; prefer the tokens above.
        tape: {
          body: "#1A1220",
          label: "#EDE6D6",
          accent: "#E8722C",
        },
        ink: "#F2EAD8",
        void: "#0E0C10",
      },
      fontFamily: {
        // LCD digits, countdown, counters, track numbers.
        lcd: ["'VT323'", "'Courier New'", "monospace"],
        // Typed labels: tape titles, buttons, tags, condition text.
        type: ["'Special Elite'", "'Courier New'", "monospace"],
        // Handwritten J-card notes.
        hand: ["'Caveat'", "cursive"],
        // Titles only (logo, page titles). Never body text.
        title: ["'Creepster'", "cursive"],
        // Long-form reading.
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        // Haunted vignette for panels.
        haunted: "inset 0 0 80px 20px rgba(0,0,0,0.75)",
        // Outer purple glow (condition-haunted, 155 107 214) for due tapes on the shelf.
        // Intensity: Haunted > Warped > Worn.
        "glow-faint": "0 0 8px 1px rgba(155,107,214,0.35)",
        "glow-medium": "0 0 16px 3px rgba(155,107,214,0.55)",
        "glow-strong": "0 0 28px 8px rgba(155,107,214,0.8)",
      },
      keyframes: {
        // Slow (4 s) opacity breathing of the glow overlay only, never the text.
        "glow-flicker": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "glow-flicker": "glow-flicker 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
