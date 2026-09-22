import { describe, expect, it } from "vitest";
import { bucketize, type BucketRange } from "../src/charts.js";

const RANGES: BucketRange[] = [
  { upTo: 5, label: "1–5", severity: "good" },
  { upTo: 10, label: "6–10", severity: "warn" },
  { upTo: Number.POSITIVE_INFINITY, label: "11+", severity: "critical" },
];

describe("bucketize", () => {
  it("counts values into the matching range", () => {
    const segments = bucketize([1, 3, 6, 10, 12, 40], RANGES);
    expect(segments.map((segment) => [segment.label, segment.value])).toEqual([
      ["1–5", 2],
      ["6–10", 2],
      ["11+", 2],
    ]);
  });

  it("drops empty buckets", () => {
    const segments = bucketize([1, 2], RANGES);
    expect(segments.map((segment) => segment.label)).toEqual(["1–5"]);
  });

  it("handles zero values", () => {
    const segments = bucketize([0, 0, 0], RANGES);
    expect(segments[0]?.value).toBe(3);
  });
});
