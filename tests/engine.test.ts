import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/config.js";
import { analyze } from "../src/core/engine.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "fixtures");

describe("analyze", () => {
  it("walks a directory and aggregates a summary", async () => {
    const report = await analyze({ root: fixtures });
    expect(report.schemaVersion).toBeDefined();
    expect(report.summary.files).toBeGreaterThanOrEqual(1);
    expect(report.summary.filesByLanguage["typescript"]).toBeGreaterThanOrEqual(1);
    expect(report.summary.metrics.cyclomatic.count).toBeGreaterThan(0);
    expect(report.files[0]?.path).toBe("simple.ts");
  });

  it("produces violations from thresholds", async () => {
    const report = await analyze({
      root: fixtures,
      config: {
        ...DEFAULT_CONFIG,
        thresholds: {
          cyclomatic: 3,
          nesting: 1,
          params: 2,
          functionLoc: 100,
          fileLoc: 1000,
        },
      },
    });
    const violations = report.files.flatMap((f) => f.violations);
    expect(violations.map((v) => v.rule).sort()).toEqual([
      "cyclomatic",
      "nesting",
    ]);
    expect(report.summary.violations.warning).toBe(2);
  });

  it("analyzes a single file target", async () => {
    const report = await analyze({
      root: path.join(fixtures, "simple.ts"),
    });
    expect(report.summary.files).toBe(1);
  });
});
