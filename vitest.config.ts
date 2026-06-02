import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "happy-dom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      exclude: ["e2e/**", "node_modules/**"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "json"],
        thresholds: {
          lines: 90,
          branches: 80,
          functions: 90,
          statements: 90,
        },
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/test/**",
          "src/vite-env.d.ts",
          "src/main.tsx",
          "src/app.tsx",
          "src/routes.tsx",
          "src/pages/**",
          "src/components/sidebar-layout.tsx",
          "src/api/client.ts",
          "e2e/**",
        ],
      },
    },
  }),
);
