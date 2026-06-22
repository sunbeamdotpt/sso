import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { statSync } from "node:fs";

const styledSystem = resolve(__dirname, "styled-system");

/**
 * Stub out beam-ui's optional deps that this app never imports.
 */
const BEAM_UI_OPTIONAL_DEPS = new Set([
  "mermaid",
  "turndown",
  "recharts",
  "katex",
  "shiki",
  "react-hook-form",
  "@hookform/resolvers",
  "@hookform/resolvers/zod",
  "zod",
]);

function resolveNpmSpecifier(id: string): string | undefined {
  if (!id.startsWith("npm:")) return;
  const rest = id.slice(4).replace(/^\//, ""); // handle npm:/ prefix too
  const m = rest.match(/^(?:@([^/]+)\/)?([^@]+)@[^/]+(\/.*)?$/);
  if (!m) return;
  const scope = m[1] ? `@${m[1]}/` : "";
  const name = m[2];
  const subpath = m[3] || "";
  return scope + name + subpath;
}

function npmAliasPlugin(): Plugin {
  return {
    name: "npm-alias",
    enforce: "pre",
    resolveId(id) {
      const bare = resolveNpmSpecifier(id);
      if (bare) return this.resolve(bare, id, { skipSelf: true });
    },
    transform(code, id) {
      // Rewrite npm: specifiers inside JSR source so that Babel JSX
      // transforms (which run later) emit bare module names instead of
      // npm: URLs that Vite would externalize.
      const isJsr = id.includes("@jsr") || id.includes("@sunbeam");
      const isViteChunk = id.includes(".vite/deps");
      if (!isJsr && !isViteChunk) return;
      const cleaned = code.replace(
        /npm:\/?((?:@[^/]+\/)?[^@]+)@[^"'\s]+/g,
        (match) => resolveNpmSpecifier(match) ?? match,
      );
      if (cleaned === code) return;
      return { code: cleaned, map: null };
    },
  };
}

/** Prevent Rollup from resolving dynamic imports of heavy optional deps.
 *  These are inside components that get tree-shaken, but Rollup still
 *  resolves dynamic imports during graph construction — which copies
 *  font assets and creates empty chunks. */
function suppressUnusedDynamicImports(): Plugin {
  const UNUSED_PKGS = new Set(["katex", "mermaid", "recharts"]);
  const UNUSED_PATHS = ["katex/dist/katex.min.css"];
  return {
    name: "suppress-unused-dynamic-imports",
    resolveDynamicImport(specifier) {
      if (typeof specifier !== "string") return;
      const bare = resolveNpmSpecifier(specifier);
      if (bare && UNUSED_PKGS.has(bare)) return false;
      if (UNUSED_PATHS.some((p) => specifier.includes(p))) return false;
    },
  };
}

function stubBeamUiOptionalDeps(): Plugin {
  const PREFIX = "\0stub:";
  const STUB_CODE = `
const _handler = {
  get: (_, k) => typeof k === "symbol" ? undefined : _stub,
  set: () => true,
  apply: () => undefined,
  construct: () => new Proxy({}, _handler),
};
const _stub = new Proxy(function(){}, _handler);
export default _stub;
`.trim();
  return {
    name: "stub-beam-ui-optional-deps",
    resolveId(id) {
      if (BEAM_UI_OPTIONAL_DEPS.has(id)) return PREFIX + id;
    },
    load(id) {
      if (id.startsWith(PREFIX)) return { code: STUB_CODE, syntheticNamedExports: true };
    },
  };
}

function styledSystemResolver(): Plugin {
  return {
    name: "styled-system-resolver",
    enforce: "pre",
    resolveId(id, importer) {
      if (!id.startsWith("styled-system")) return;
      const base = styledSystem;
      const subpath = id.slice("styled-system".length).replace(/^\//, "");
      const resolved = subpath ? resolve(base, subpath) : base;
      // If the resolved path is a directory, point to its index module so
      // Vite doesn't try to open the directory as a file.
      try {
        if (subpath && !subpath.includes(".") && statSync(resolved).isDirectory()) {
          const indexPath = resolve(resolved, "index.mjs");
          if (statSync(indexPath).isFile()) return indexPath;
        }
      } catch { /* not a directory or no index */ }
      return resolved;
    },
  };
}

export default defineConfig({
  plugins: [npmAliasPlugin(), styledSystemResolver(), suppressUnusedDynamicImports(), stubBeamUiOptionalDeps(), react()],
  resolve: {
    alias: {},
  },
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/self-service": {
        target: "http://localhost:4433",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:4433",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            // Browser flows need Origin and Cookie headers to pass through
            // for Kratos CSRF validation. No stripping needed.
          });
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: "esbuild-npm-alias",
          setup(build) {
            build.onResolve({ filter: /^npm:\/?/ }, (args) => {
              const bare = resolveNpmSpecifier(args.path);
              if (bare) return { path: bare, external: true };
            });
          },
        },
      ],
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/.test(id)) {
              return "vendor-react";
            }
            if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) {
              return "vendor-router";
            }
            if (/[\\/]node_modules[\\/](@ark-ui|@zag-js|@floating-ui|@internationalized)[\\/]/.test(id)) {
              return "vendor-ark";
            }
            if (/[\\/]node_modules[\\/](@sunbeam|@legendapp|@connectrpc|@bufbuild|@opentelemetry)[\\/]/.test(id)) {
              return "vendor-beam";
            }
          }
        },
      },
    },
  },
});
