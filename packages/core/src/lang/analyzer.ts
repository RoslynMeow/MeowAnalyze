import type { FileReport, LanguageId } from "../report/model.js";

/** Everything a language analyzer needs to analyze a single file. */
export interface FileContext {
  /** Path relative to the analyzed root (forward slashes). */
  path: string;
  /** Full source text (already decoded as UTF-8). */
  source: string;
  /** Resolved language id for this file. */
  language: LanguageId;
}

/**
 * Contract every language front-end implements.
 *
 * The engine only walks files and dispatches to the matching analyzer; all
 * parsing and metric extraction lives behind this seam. Adding a language means
 * adding an implementation, not touching the engine.
 *
 * Analyzers must not throw for malformed input: they should return a report
 * with whatever could be measured. `violations` is left empty here and filled
 * by the engine from the configured thresholds.
 */
export interface LanguageAnalyzer {
  readonly id: LanguageId;
  /** Lowercase extensions, including the dot, e.g. [".ts", ".tsx"]. */
  readonly extensions: readonly string[];
  /** Whether this analyzer claims the file. `head` is the first bytes. */
  matches(path: string, head: string): boolean;
  analyze(ctx: FileContext): FileReport;
}
