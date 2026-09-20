import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  isIgnoredPath,
  stripCommonRoot,
  zipToSources,
} from "../src/sources.js";

describe("isIgnoredPath", () => {
  it("ignores vendored and build folders", () => {
    expect(isIgnoredPath("node_modules/pkg/index.js")).toBe(true);
    expect(isIgnoredPath("dist/index.js")).toBe(true);
    expect(isIgnoredPath("src/index.ts")).toBe(false);
  });
});

describe("stripCommonRoot", () => {
  it("removes a shared top-level folder", () => {
    const sources = stripCommonRoot([
      { path: "proj/src/a.ts", content: "a" },
      { path: "proj/README.md", content: "b" },
    ]);
    expect(sources.map((s) => s.path)).toEqual(["src/a.ts", "README.md"]);
  });

  it("leaves paths alone when there is no shared root", () => {
    const sources = stripCommonRoot([
      { path: "a.ts", content: "a" },
      { path: "src/b.ts", content: "b" },
    ]);
    expect(sources.map((s) => s.path)).toEqual(["a.ts", "src/b.ts"]);
  });
});

describe("zipToSources", () => {
  it("extracts, filters and normalizes archive entries", () => {
    const archive = zipSync({
      "proj/src/a.ts": strToU8("export const a = 1;\n"),
      "proj/node_modules/b.ts": strToU8("ignore me"),
      "proj/README.md": strToU8("# hello"),
    });
    const sources = zipToSources(archive);
    expect(sources.map((s) => s.path)).toEqual(["README.md", "src/a.ts"]);
    expect(sources[1]?.content).toBeInstanceOf(Uint8Array);
  });
});
