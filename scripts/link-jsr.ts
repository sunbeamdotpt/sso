#!/usr/bin/env -S deno run -A
/**
 * Create node_modules symlinks so Vite can resolve JSR packages
 * imported as `@sunbeam/<name>` while Deno resolves them via `npm:@jsr/sunbeam__<name>`.
 */

const DENO_JSON = new URL("../deno.json", import.meta.url);
const NODE_MODULES = new URL("../node_modules/", import.meta.url);

const text = await Deno.readTextFile(DENO_JSON);
const manifest = JSON.parse(text) as { imports?: Record<string, string> };

const jsrAliasPattern = /^npm:@jsr\/sunbeam__([^@]+)@.*$/;

for (const [alias, target] of Object.entries(manifest.imports ?? {})) {
  if (!alias.startsWith("@sunbeam/")) continue;

  // Only handle root imports (not subpaths like @sunbeam/g2v/rest)
  if (alias.includes("/", "@sunbeam/".length)) continue;

  const match = jsrAliasPattern.exec(target);
  if (!match) continue;

  const pkgName = match[1];
  const linkPath = new URL(`@sunbeam/${pkgName}`, NODE_MODULES).pathname;
  const targetPath = `../@jsr/sunbeam__${pkgName}`;

  try {
    const stat = await Deno.lstat(linkPath);
    if (stat.isSymlink) {
      console.log(`  ✓ @sunbeam/${pkgName} already linked`);
      continue;
    }
    console.log(
      `  ! @sunbeam/${pkgName} exists but is not a symlink, skipping`,
    );
    continue;
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }

  try {
    await Deno.mkdir(new URL("@sunbeam", NODE_MODULES).pathname, {
      recursive: true,
    });
  } catch { /* ignore */ }

  await Deno.symlink(targetPath, linkPath);
  console.log(`  → @sunbeam/${pkgName} → @jsr/sunbeam__${pkgName}`);
}

// Patch sideEffects: false so Rollup tree-shakes unused re-exports.
const packagesToPatch = ["@jsr/sunbeam__beam-ui", "@jsr/sunbeam__g2v"];
for (const pkg of packagesToPatch) {
  const pkgJsonPath = new URL(`${pkg}/package.json`, NODE_MODULES).pathname;
  try {
    const raw = await Deno.readTextFile(pkgJsonPath);
    const pkgJson = JSON.parse(raw) as { sideEffects?: unknown };
    if (pkgJson.sideEffects !== false) {
      pkgJson.sideEffects = false;
      await Deno.writeTextFile(
        pkgJsonPath,
        JSON.stringify(pkgJson, null, 2) + "\n",
      );
      console.log(`  → patched sideEffects: false for ${pkg}`);
    } else {
      console.log(`  ✓ ${pkg} already has sideEffects: false`);
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.log(`  ! ${pkg} not found, skipping sideEffects patch`);
    } else {
      throw e;
    }
  }
}

console.log("Done.");
