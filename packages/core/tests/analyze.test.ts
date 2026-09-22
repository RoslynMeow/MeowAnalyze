import { describe, expect, it } from "vitest";
import {
  analyzeSources,
  DEFAULT_CONFIG,
  DEFAULT_THRESHOLDS,
  defaultThresholds,
  resolveThresholds,
} from "../src/index.js";

const SIMPLE = `export function f(n: number) {
  if (n > 0 && n < 10) return n;
  return -n;
}
`;

describe("analyzeSources (pure core, no filesystem)", () => {
  it("analyzes in-memory sources", () => {
    const report = analyzeSources({
      root: "mem",
      sources: [{ path: "a.ts", content: SIMPLE }],
    });
    expect(report.root).toBe("mem");
    expect(report.summary.files).toBe(1);
    expect(report.files[0]?.functions[0]?.cyclomatic).toBe(3);
  });

  it("skips binary content", () => {
    const report = analyzeSources({
      root: "mem",
      sources: [
        { path: "blob.bin", content: new Uint8Array([0x00, 0x01, 0x02]) },
      ],
    });
    expect(report.summary.files).toBe(0);
    expect(report.diagnostics[0]?.message).toContain("binary");
  });

  it("ignores files whose language is unknown", () => {
    const report = analyzeSources({
      root: "mem",
      sources: [{ path: "script.rb", content: "puts 1" }],
    });
    expect(report.summary.files).toBe(0);
  });

  it("routes thresholds into violations", () => {
    const report = analyzeSources({
      root: "mem",
      sources: [{ path: "a.ts", content: SIMPLE }],
      config: {
        ...DEFAULT_CONFIG,
        thresholds: {
          cyclomatic: 1,
          cognitive: 99,
          nesting: 0,
          params: 0,
          functionLoc: 1,
          fileLoc: 1,
        },
      },
    });
    expect(report.summary.violations.warning).toBeGreaterThan(0);
  });

  it("ships Sonar-aligned defaults", () => {
    expect(DEFAULT_THRESHOLDS.cyclomatic).toBe(15);
    expect(DEFAULT_THRESHOLDS.params).toBe(7);
    expect(DEFAULT_THRESHOLDS.functionLoc).toBe(100);
  });

  it("resolves per-language defaults under partial overrides", () => {
    expect(defaultThresholds("typescript")).toBe(DEFAULT_THRESHOLDS);
    expect(resolveThresholds("javascript", { params: 3 })).toMatchObject({
      cyclomatic: 15,
      params: 3,
    });
    // Unknown languages fall back to the global profile.
    expect(resolveThresholds("rust").cyclomatic).toBe(15);
  });
});
