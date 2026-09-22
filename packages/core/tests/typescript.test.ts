import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TypeScriptAnalyzer } from "../src/lang/typescript.js";
import type { FileReport, FunctionReport } from "../src/report/model.js";

const analyzer = new TypeScriptAnalyzer();
const here = path.dirname(fileURLToPath(import.meta.url));

function analyzeSource(source: string, file = "test.ts"): FileReport {
  return analyzer.analyze({ path: file, source, language: "typescript" });
}

function fn(report: FileReport, name: string): FunctionReport {
  const found = report.functions.find((f) => f.name === name);
  if (!found) throw new Error(`function '${name}' not found`);
  return found;
}

describe("TypeScriptAnalyzer.matches", () => {
  it("claims TS/JS extensions only", () => {
    expect(analyzer.matches("a.ts", "")).toBe(true);
    expect(analyzer.matches("a.tsx", "")).toBe(true);
    expect(analyzer.matches("a.mjs", "")).toBe(true);
    expect(analyzer.matches("a.py", "")).toBe(false);
    expect(analyzer.matches("README", "")).toBe(false);
  });
});

describe("functions and complexity", () => {
  const report = analyzeSource(
    readFileSync(path.join(here, "fixtures/simple.ts"), "utf8"),
    "simple.ts",
  );

  it("collects every function", () => {
    expect(report.functions.map((f) => f.name).sort()).toEqual([
      "abs",
      "add",
      "classify",
      "increment",
    ]);
  });

  it("measures a trivial function", () => {
    const add = fn(report, "add");
    expect(add.kind).toBe("function");
    expect(add.cyclomatic).toBe(1);
    expect(add.maxNesting).toBe(0);
    expect(add.params).toBe(2);
  });

  it("counts decision points (if / else-if / for / &&)", () => {
    const classify = fn(report, "classify");
    expect(classify.cyclomatic).toBe(6);
    expect(classify.maxNesting).toBe(2);
  });

  it("treats a ternary as a decision", () => {
    expect(fn(report, "abs").kind).toBe("arrow");
    expect(fn(report, "abs").cyclomatic).toBe(2);
  });

  it("measures cognitive complexity (nesting weighted)", () => {
    expect(fn(report, "add").cognitive).toBe(0);
    expect(fn(report, "abs").cognitive).toBe(1);
    expect(fn(report, "classify").cognitive).toBe(6);
  });

  it("counts code lines per function", () => {
    expect(fn(report, "abs").loc).toBe(1); // one-line arrow
    expect(fn(report, "add").loc).toBe(3); // signature, body, closing brace
    expect(fn(report, "abs").maintainability).toBeGreaterThan(0);
  });

  it("computes Halstead metrics and a maintainability index", () => {
    const add = fn(report, "add");
    expect(add.halstead.volume).toBeGreaterThan(0);
    expect(add.halstead.vocabulary).toBeGreaterThan(0);
    expect(add.maintainability).toBeGreaterThan(0);
    expect(add.maintainability).toBeLessThanOrEqual(100);
  });

  it("classifies methods", () => {
    expect(fn(report, "increment").kind).toBe("method");
  });

  it("builds a stable id", () => {
    expect(fn(report, "add").id).toBe("simple.ts:3:add");
  });

  it("aggregates file metrics", () => {
    expect(report.metrics.cyclomatic.count).toBe(4);
    expect(report.metrics.cyclomatic.max).toBe(6);
  });
});

describe("markers", () => {
  it("counts TODO / FIXME / HACK in comments", () => {
    const report = analyzeSource(
      [
        "// TODO: one",
        "/* FIXME: two */",
        "const a = 1; // HACK three",
      ].join("\n"),
    );
    expect(report.markers).toEqual({ todo: 1, fixme: 1, hack: 1 });
  });
});

describe("lines of code", () => {  it("splits code / comment / blank / logical", () => {
    const source = [
      "// comment",
      "const a = 1;",
      "",
      "/* block",
      "   comment */",
      "function f() {",
      "  return a;",
      "}",
    ].join("\n");
    const report = analyzeSource(source);
    expect(report.loc).toEqual({
      physical: 8,
      code: 4,
      comment: 3,
      blank: 1,
      logical: 3,
    });
  });

  it("counts a function's code lines, ignoring blanks and comments", () => {
    const source = [
      "function f() {",
      "",
      "  // just a comment",
      "  const a = 1;",
      "",
      "  return a;",
      "}",
    ].join("\n");
    // Lines 1 (declaration), 4 (const), 6 (return) and 7 (`}`) are code.
    expect(fn(analyzeSource(source), "f").loc).toBe(4);
  });
});
