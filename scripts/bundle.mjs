// Produces a single self-contained CJS file at dist/meowanalyze.cjs.
//
// Useful for distributing/embedding without installing dependencies, and as
// the input for Node SEA. Native single-file binaries are built with
// `npm run compile` (Bun).
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

await build({
  entryPoints: ["packages/cli/src/cli.ts"],
  outfile: "dist/meowanalyze.cjs",
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  alias: {
    "@meowanalyze/core": fileURLToPath(
      new URL("../packages/core/src/index.ts", import.meta.url),
    ),
  },
  logLevel: "info",
});
