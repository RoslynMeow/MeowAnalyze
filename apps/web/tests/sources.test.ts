// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fileListToSources, isIgnoredPath } from "../src/sources.js";

describe("isIgnoredPath", () => {
  it("ignores vendored and build folders", () => {
    expect(isIgnoredPath("node_modules/pkg/index.js")).toBe(true);
    expect(isIgnoredPath("dist/index.js")).toBe(true);
    expect(isIgnoredPath("src/index.ts")).toBe(false);
  });
});

describe("fileListToSources", () => {
  it("keeps relative paths and skips ignored folders", async () => {
    const files = [
      new File(["export const a = 1;"], "a.ts", { type: "text/plain" }),
      new File(["ignored"], "node_modules/b.ts", { type: "text/plain" }),
    ];
    // jsdom's File has no webkitRelativePath; emulate it for the second file.
    Object.defineProperty(files[1], "webkitRelativePath", {
      value: "node_modules/b.ts",
    });

    const sources = await fileListToSources(files);
    expect(sources.map((source) => source.path)).toEqual(["a.ts"]);
    expect(sources[0]?.content).toBeInstanceOf(Uint8Array);
  });
});
