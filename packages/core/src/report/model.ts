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

/** Halstead software-science measures, computed from operators and operands. */
export interface Halstead {
  distinctOperators: number;
  distinctOperands: number;
  totalOperators: number;
  totalOperands: number;
  vocabulary: number;
  length: number;
  volume: number;
  difficulty: number;
  effort: number;
}

/** Counts of common in-comment markers. */
export interface Markers {
  todo: number;
  fixme: number;
  hack: number;
}

/* ------------------------------------------------------------------ */
/* OOP structure (classes / interfaces / enums, imports, call graph)   */
/* ------------------------------------------------------------------ */

export type DeclarationKind = "class" | "interface" | "enum";

export type MemberKind =
  | "property"
  | "method"
  | "constructor"
  | "getter"
  | "setter"
  | "enum-member";

export type Visibility = "public" | "protected" | "private";

export interface MemberReport {
  name: string;
  kind: MemberKind;
  visibility: Visibility;
  static: boolean;
  abstract: boolean;
  readonly: boolean;
  optional: boolean;
  /** Type annotation text, e.g. `string`, `Array<Foo>`, if present. */
  type?: string;
  /** Parameter count for methods, constructors and accessors. */
  params?: number;
}

/** A class, interface or enum declaration. */
export interface DeclarationReport {
  /** Stable id: `path:line:name`. */
  id: string;
  name: string;
  kind: DeclarationKind;
  path: string;
  line: number;
  abstract: boolean;
  /** Extended classes or interfaces. */
  extends: string[];
  /** Implemented interfaces. */
  implements: string[];
  members: MemberReport[];
}

/** One import (or re-export) statement of a file. */
export interface ImportReport {
  /** Raw module specifier, e.g. `./foo` or `react`. */
  module: string;
  /** Imported binding names (default, named or namespace). */
  names: string[];
  typeOnly: boolean;
}

/** A node of the per-function control-flow tree used for activity diagrams. */
export type FlowNode =
  | { kind: "action"; text: string }
  | { kind: "decision"; branches: FlowBranch[] }
  | { kind: "loop"; label: string; body: FlowNode[] }
  | { kind: "terminator"; text: string };

export interface FlowBranch {
  label: string;
  body: FlowNode[];
}

/** Resolved cross-file edges used by the diagram views. */
export interface ModuleEdge {
  from: string;
  to: string;
}

export interface CallEdge {
  from: string;
  to: string;
}

/** Project-level OOP structure derived from the per-file reports. */
export interface StructureModel {
  declarations: DeclarationReport[];
  /** File-to-file dependencies resolved from relative imports. */
  dependencies: ModuleEdge[];
  /** Function-to-function calls (static approximation). */
  calls: CallEdge[];
}

export interface FunctionReport {
  /** Stable id: `path:startLine:name`. */
  id: string;
  name: string;
  /** Enclosing class / interface name, when the function is a member. */
  owner?: string;
  kind: FunctionKind;
  range: Range;
  /** Physical lines spanned by the function. */
  loc: number;
  params: number;
  cyclomatic: number;
  /** Nesting-weighted cognitive complexity (Sonar-style). */
  cognitive: number;
  maxNesting: number;
  halstead: Halstead;
  /** Maintainability index, 0–100 (higher is better). */
  maintainability: number;
  /** Callee texts found in the body, e.g. `foo`, `this.bar` (static approximation). */
  calls: string[];
  /** Control-flow tree for the activity diagram. */
  flow: FlowNode[];
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
  cognitive: Distribution;
  nesting: Distribution;
  functionLoc: Distribution;
  params: Distribution;
  maintainability: Distribution;
  halsteadVolume: Distribution;
  halsteadDifficulty: Distribution;
  halsteadEffort: Distribution;
}

export interface FileReport {
  /** Path relative to the analyzed root, using forward slashes. */
  path: string;
  language: LanguageId;
  loc: LocStats;
  /** File-level maintainability index, 0–100. */
  maintainability: number;
  metrics: FileMetrics;
  markers: Markers;
  functions: FunctionReport[];
  declarations: DeclarationReport[];
  imports: ImportReport[];
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
  /** Average file-level maintainability index, 0–100. */
  maintainability: number;
  metrics: FileMetrics;
  markers: Markers;
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
  structure: StructureModel;
  diagnostics: Diagnostic[];
}
