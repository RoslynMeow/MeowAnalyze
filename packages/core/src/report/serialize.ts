import type { AnalysisReport } from "./model.js";

/** Serialize a report to JSON. This is the stable interface for CI and UI. */
export function toJson(report: AnalysisReport, pretty = true): string {
  return JSON.stringify(report, null, pretty ? 2 : undefined);
}
