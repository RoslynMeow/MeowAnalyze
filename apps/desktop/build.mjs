// Bundles the Electron main + preload processes and copies the built web app
// into dist-web so it can be packaged with the desktop app.
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = fileURLToPath(new URL(".", import.meta.url));
const outDir = path.join(here, "dist-electron");

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
};

await build({
  ...shared,
  entryPoints: [path.join(here, "src", "main.ts")],
  outfile: path.join(outDir, "main.cjs"),
});

await build({
  ...shared,
  entryPoints: [path.join(here, "src", "preload.ts")],
  outfile: path.join(outDir, "preload.cjs"),
});

// Copy the web build so the renderer can load it from disk.
const webDist = path.join(here, "..", "web", "dist");
const target = path.join(here, "dist-web");
await rm(target, { recursive: true, force: true });
await cp(webDist, target, { recursive: true });
console.log(`copied web build -> ${path.relative(here, target)}`);
