/**
 * Report data model — the stable contract shared by the CLI, JSON output and
 * any future UI (Tauri / web / WASM). Everything here is plain serializable
 * data; the analyzer engine never leaks AST nodes into the report.
 *
 * Design rules:
 *  - Counts are integers, ratios/scores are floats.
 *  - Line/column numbers are 1-based and user facing.
 *  - Metrics that a language cannot compute are simply absent (never fake 0).
 */

export const SCHEMA_VERSION = "0.1.0";

/** Canonical id of a language, e.g. "typescript" | "javascript" | "unknown". */
export type LanguageId = string;

/** 1-based position. */
export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

/** Lines of code, split by kind. `code + comment + blank === physical`. */
export interface LocStats {
  physical: number;
  code: number;
  comment: number;
  blank: number;
  /** Logical statements parsed from the AST. */
  logical: number;
}

export type FunctionKind =
  | "function"
  | "method"
  | "constructor"
  | "arrow"
  | "getter"
  | "setter";

/**
 * Summary of one numeric metric across a set of functions.
 * Gives CI both aggregate (`sum`, `max`) and UI distribution data at once.
 */
export interface Distribution {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
}

export interface FunctionReport {
  /** Stable id: `path:startLine:name`. */
  id: string;
  name: string;
  kind: FunctionKind;
  range: Range;
  /** Physical lines spanned by the function. */
  loc: number;
  params: number;
  cyclomatic: number;
  maxNesting: number;
}

export type Level = "info" | "warning" | "error";

export interface Violation {
  rule: string;
  level: Level;
  actual: number;
  limit: number;
  /** Where the violation is anchored (function range or full file). */
  location: Range;
  functionId?: string;
  message: string;
}

export interface FileMetrics {
  cyclomatic: Distribution;
  nesting: Distribution;
  functionLoc: Distribution;
  params: Distribution;
}

export interface FileReport {
  /** Path relative to the analyzed root, using forward slashes. */
  path: string;
  language: LanguageId;
  loc: LocStats;
  metrics: FileMetrics;
  functions: FunctionReport[];
  violations: Violation[];
}

export interface ViolationSummary {
  total: number;
  error: number;
  warning: number;
  info: number;
}

export interface Summary {
  files: number;
  filesByLanguage: Record<LanguageId, number>;
  loc: LocStats;
  metrics: FileMetrics;
  violations: ViolationSummary;
}

export interface Diagnostic {
  path: string;
  level: Level;
  message: string;
}

/** Root of the JSON document / library result. */
export interface AnalysisReport {
  schemaVersion: string;
  toolVersion: string;
  root: string;
  generatedAt: string;
  durationMs: number;
  summary: Summary;
  files: FileReport[];
  diagnostics: Diagnostic[];
}
