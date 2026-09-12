import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E1116",        // near-black graphite background
        panel: "#151A22",      // card surface
        line: "#232A35",       // hairline borders
        paper: "#E9ECEF",      // primary text
        muted: "#8891A1",      // secondary text
        signal: "#4FD1A5",     // single accent: liquidity/safe green
        alert: "#E8846B",      // risk/warning accent, used sparingly
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
