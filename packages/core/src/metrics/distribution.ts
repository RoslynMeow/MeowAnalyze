import type { Distribution } from "../report/model.js";

export function emptyDistribution(): Distribution {
  return { count: 0, sum: 0, min: 0, max: 0, mean: 0 };
}

/** Build a distribution from raw samples. Empty input yields a zeroed distribution. */
export function distributionOf(values: readonly number[]): Distribution {
  if (values.length === 0) return emptyDistribution();
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return {
    count: values.length,
    sum,
    min,
    max,
    mean: sum / values.length,
  };
}

/** Combine distributions as if the underlying samples were pooled. */
export function mergeDistributions(
  parts: readonly Distribution[],
): Distribution {
  let count = 0;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const part of parts) {
    if (part.count === 0) continue;
    count += part.count;
    sum += part.sum;
    if (part.min < min) min = part.min;
    if (part.max > max) max = part.max;
  }
  if (count === 0) return emptyDistribution();
  return { count, sum, min, max, mean: sum / count };
}
