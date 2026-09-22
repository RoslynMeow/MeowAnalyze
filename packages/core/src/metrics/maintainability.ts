/**
 * Normalized maintainability index (0–100, higher is better), shared by every
 * language analyzer so the metric is comparable across languages.
 *
 * `loc` is the code-line count (lines containing source tokens).
 */
export function maintainabilityIndex(
  volume: number,
  cyclomatic: number,
  loc: number,
): number {
  if (loc <= 0) return 100;
  const raw =
    171 -
    3.42 * Math.log(Math.max(volume, 1)) -
    0.23 * cyclomatic -
    16.2 * Math.log(loc);
  return Math.max(0, Math.min(100, (raw * 100) / 171));
}
