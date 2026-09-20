/**
 * Small, dependency-free helpers shared by the views. Chart rendering itself
 * uses ECharts (see `pie.ts`); this module only holds colors and bucketing.
 */

export const PALETTE: readonly string[] = [
  "#58a6ff",
  "#3fb950",
  "#d29922",
  "#f85149",
  "#bc8cff",
  "#39c5cf",
  "#ff7b72",
  "#a5d6ff",
];

export function complexityColor(value: number): string {
  if (value >= 20) return "#f85149";
  if (value >= 10) return "#d29922";
  return "#3fb950";
}

export function maintainabilityColor(value: number): string {
  if (value < 40) return "#f85149";
  if (value < 65) return "#d29922";
  return "#3fb950";
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface BucketRange {
  upTo: number;
  label: string;
  color: string;
}

/** Count values into ranges and return non-empty donut segments. */
export function bucketize(
  values: readonly number[],
  ranges: readonly BucketRange[],
): DonutSegment[] {
  const counts = ranges.map((range) => ({
    label: range.label,
    value: 0,
    color: range.color,
  }));
  for (const value of values) {
    const index = ranges.findIndex((range) => value <= range.upTo);
    const target = counts[index === -1 ? ranges.length - 1 : index];
    if (target) target.value++;
  }
  return counts.filter((segment) => segment.value > 0);
}
