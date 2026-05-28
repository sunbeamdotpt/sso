import { defineConfig } from "@pandacss/dev";
import { beamPreset } from "@sunbeam/beam-ui/preset";

export default defineConfig({
  preflight: true,
  presets: [beamPreset],
  include: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@sunbeam/beam-ui/dist/**/*.js",
    "./node_modules/@sunbeam/beam-ui/src/**/*.{ts,tsx}",
  ],
  exclude: [],
  outdir: "styled-system",
});
