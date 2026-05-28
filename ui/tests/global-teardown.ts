/**
 * Global teardown — flattens all per-test screenshot subdirectories
 * into a single root folder so screenshots are easy to browse.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const OUTPUT_DIR = "tests/__screenshots__";

async function flatten(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    // Skip Playwright's own artifact directories — let it clean those up
    if (entry.name.startsWith(".")) continue;

    // Recursively move files from nested dir up to root
    const nested = await fs.readdir(fullPath, { withFileTypes: true, recursive: true });
    for (const child of nested) {
      if (!child.isFile()) continue;
      const rel = path.relative(fullPath, path.join(fullPath, child.name));
      const src = path.join(fullPath, child.name);
      // Always prefix with parent dir name so every flattened file is unique
      const base = entry.name.replace(/\s+/g, "_");
      const dest = path.join(dir, `${base}_${child.name}`);
      await fs.rename(src, dest);
    }
    // Remove the nested directory tree
    await fs.rm(fullPath, { recursive: true, force: true });
  }
}

export default async function globalTeardown(): Promise<void> {
  await flatten(OUTPUT_DIR);
}
