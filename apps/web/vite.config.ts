import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build`          -> apps/web/dist          (normal static site)
// `vite build --mode single` -> apps/web/dist-single/index.html (one file, offline/embeddable)
export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    // Relative asset URLs so the built site also works from file:// (Electron).
    base: "./",
    plugins: single ? [viteSingleFile()] : [],
    resolve: {
      alias: {
        "@meowanalyze/core": fileURLToPath(
          new URL("../../packages/core/src/index.ts", import.meta.url),
        ),
      },
    },
    build: {
      target: "es2022",
      outDir: single ? "dist-single" : "dist",
      emptyOutDir: true,
      ...(single
        ? { assetsInlineLimit: 100_000_000, cssCodeSplit: false }
        : {}),
    },
  };
});
