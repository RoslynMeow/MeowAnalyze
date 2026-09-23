/**
 * Small, dependency-free helpers shared by the views. Chart rendering itself
 * uses ECharts (see `pie.ts`); this module only holds colors and bucketing.
 */

import { getTheme, type Theme } from "./theme.js";

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

/** Severity of a metric value, used to pick a theme-aware color. */
export type Severity = "good" | "warn" | "bad" | "critical";

const SEVERITY_COLORS: Record<Theme, Record<Severity, string>> = {
  dark: {
    good: "#3fb950",
    warn: "#d29922",
    bad: "#f0883e",
    critical: "#f85149",
  },
  light: {
    good: "#1a7f37",
    warn: "#9a6700",
    bad: "#bc4c00",
    critical: "#cf222e",
  },
};

/** Resolve a severity to a hex color for the active theme. */
export function severityColor(severity: Severity): string {
  return SEVERITY_COLORS[getTheme()][severity];
}

export function complexityColor(value: number): string {
  if (value >= 20) return severityColor("critical");
  if (value >= 10) return severityColor("warn");
  return severityColor("good");
}

export function maintainabilityColor(value: number): string {
  // Common 0–100 grading (the original MI paper): < 65 hard, 65–85 moderate, ≥ 85 good.
  if (value < 65) return severityColor("critical");
  if (value < 85) return severityColor("warn");
  return severityColor("good");
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface BucketRange {
  upTo: number;
  label: string;
  severity: Severity;
}

/** Count values into ranges and return non-empty donut segments. */
export function bucketize(
  values: readonly number[],
  ranges: readonly BucketRange[],
): DonutSegment[] {
  const counts = ranges.map((range) => ({
    label: range.label,
    value: 0,
    color: severityColor(range.severity),
  }));
  for (const value of values) {
    const index = ranges.findIndex((range) => value <= range.upTo);
    const target = counts[index === -1 ? ranges.length - 1 : index];
    if (target) target.value++;
  }
  return counts.filter((segment) => segment.value > 0);
}
