import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The banner lives in the shared docs folder; serve it as a static asset
// instead of duplicating it into the app.
const publicDir = fileURLToPath(new URL("../../docs/assets", import.meta.url));

export default defineConfig({
  publicDir,
  resolve: {
    alias: {
      "@meowanalyze/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
});
