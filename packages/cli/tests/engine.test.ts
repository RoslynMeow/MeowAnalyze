import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@meowanalyze/core";
import { analyze } from "../src/engine.js";

const SOURCE = `export function f(n: number) {
  if (n > 0 && n < 10) return n;
  return -n;
}
`;

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "meowanalyze-"));
  await mkdir(path.join(dir, "src"), { recursive: true });
  await writeFile(path.join(dir, "src", "a.ts"), SOURCE);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("analyze (Node host)", () => {
  it("walks a directory and aggregates a summary", async () => {
    const report = await analyze({ root: dir });
    expect(report.summary.files).toBe(1);
    expect(report.summary.filesByLanguage["typescript"]).toBe(1);
    expect(report.files[0]?.path).toBe("src/a.ts");
    expect(report.summary.metrics.cyclomatic.count).toBe(1);
    expect(report.summary.metrics.cyclomatic.max).toBe(3);
  });

  it("produces violations from thresholds", async () => {
    const report = await analyze({
      root: dir,
      config: {
        ...DEFAULT_CONFIG,
        thresholds: {
          cyclomatic: 1,
          nesting: 99,
          params: 99,
          functionLoc: 999,
          fileLoc: 999,
        },
      },
    });
    const violations = report.files.flatMap((f) => f.violations);
    expect(violations.map((v) => v.rule)).toEqual(["cyclomatic"]);
    expect(report.summary.violations.warning).toBe(1);
  });

  it("analyzes a single file target", async () => {
    const report = await analyze({ root: path.join(dir, "src", "a.ts") });
    expect(report.summary.files).toBe(1);
  });
});
