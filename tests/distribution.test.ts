import { describe, expect, it } from "vitest";
import {
  distributionOf,
  emptyDistribution,
  mergeDistributions,
} from "../src/metrics/distribution.js";

describe("distributionOf", () => {
  it("returns a zeroed distribution for no samples", () => {
    expect(distributionOf([])).toEqual(emptyDistribution());
  });

  it("computes count/sum/min/max/mean", () => {
    expect(distributionOf([1, 2, 3, 4])).toEqual({
      count: 4,
      sum: 10,
      min: 1,
      max: 4,
      mean: 2.5,
    });
  });
});

describe("mergeDistributions", () => {
  it("pools samples from multiple distributions", () => {
    const merged = mergeDistributions([
      distributionOf([1, 3]),
      distributionOf([5]),
      emptyDistribution(),
    ]);
    expect(merged).toEqual({
      count: 3,
      sum: 9,
      min: 1,
      max: 5,
      mean: 3,
    });
  });

  it("returns empty when all parts are empty", () => {
    expect(mergeDistributions([emptyDistribution()])).toEqual(
      emptyDistribution(),
    );
  });
});
