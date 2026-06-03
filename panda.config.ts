import { defineConfig } from "@pandacss/dev";
import { beamPreset } from "@sunbeam/beam-ui/preset";

export default defineConfig({
  preflight: true,
  presets: [beamPreset],
  include: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@sunbeam/beam-ui/src/**/*.tsx",
  ],
  exclude: [],
  outdir: "styled-system",
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          error: {
            value: { base: "#dc2626", _dark: "#ef4444" },
          },
          success: {
            value: { base: "#16a34a", _dark: "#22c55e" },
          },
          warning: {
            value: { base: "#d97706", _dark: "#f59e0b" },
          },
        },
      },
    },
  },
});
