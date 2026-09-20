import { describe, expect, it } from "vitest";
import { computeHistogram, squarify } from "../src/charts.js";

describe("computeHistogram", () => {
  it("uses one bin per integer value when the range is small", () => {
    const bins = computeHistogram([1, 1, 2, 3]);
    expect(bins.map((bin) => bin.label)).toEqual(["1", "2", "3"]);
    expect(bins.map((bin) => bin.count)).toEqual([2, 1, 1]);
  });

  it("groups the tail into maxBins buckets for wide ranges", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const bins = computeHistogram(values, 5);
    expect(bins).toHaveLength(5);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(100);
  });

  it("returns nothing for empty input", () => {
    expect(computeHistogram([])).toEqual([]);
  });
});

describe("squarify", () => {
  it("lays out one rect per value within the bounds", () => {
    const rects = squarify([1, 2, 3], { x: 0, y: 0, w: 100, h: 100 });
    expect(rects).toHaveLength(3);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(-0.001);
      expect(rect.y).toBeGreaterThanOrEqual(-0.001);
      expect(rect.x + rect.w).toBeLessThanOrEqual(100.001);
      expect(rect.y + rect.h).toBeLessThanOrEqual(100.001);
    }
  });

  it("allocates area proportionally to the values", () => {
    const rects = squarify([1, 3], { x: 0, y: 0, w: 100, h: 100 });
    const areas = rects.map((rect) => rect.w * rect.h);
    expect(areas[0]).toBeCloseTo(2500, 0);
    expect(areas[1]).toBeCloseTo(7500, 0);
  });

  it("handles empty and zero input", () => {
    expect(squarify([], { x: 0, y: 0, w: 10, h: 10 })).toEqual([]);
    expect(squarify([0, 0], { x: 0, y: 0, w: 10, h: 10 })).toEqual([]);
  });
});
