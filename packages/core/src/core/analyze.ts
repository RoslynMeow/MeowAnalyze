import { DEFAULT_CONFIG, type Config } from "../config/thresholds.js";
import { defaultRegistry, type LanguageRegistry } from "../lang/registry.js";
import { mergeDistributions } from "../metrics/distribution.js";
import {
  SCHEMA_VERSION,
  type AnalysisReport,
  type Diagnostic,
  type FileReport,
  type LocStats,
  type Markers,
  type Summary,
  type ViolationSummary,
} from "../report/model.js";
import { toolVersion } from "../version.js";
import { applyThresholds } from "./thresholds.js";

/** One in-memory file to analyze. Bytes are preferred so binary detection works. */
export interface SourceInput {
  /** Path relative to the analyzed root (forward slashes). */
  path: string;
  content: Uint8Array | string;
}

export interface AnalyzeSourcesOptions {
  /** Logical root name shown in the report (a real path on Node, a label in the browser). */
  root: string;
  sources: readonly SourceInput[];
  config?: Config;
  registry?: LanguageRegistry;
  /** Diagnostics collected before analysis (e.g. read failures by the host). */
  diagnostics?: readonly Diagnostic[];
  /** Overridable clock, mainly for deterministic tests. */
  now?: () => number;
  toolVersion?: string;
}

/**
 * Platform-agnostic analysis core.
 *
 * It performs no I/O: the host (Node fs, browser File System Access API, zip
 * extraction, ...) is responsible for producing `SourceInput`s. This is the
 * single entry point shared by the CLI and any future web/desktop UI.
 */
export function analyzeSources(options: AnalyzeSourcesOptions): AnalysisReport {
  const config = options.config ?? DEFAULT_CONFIG;
  const registry = options.registry ?? defaultRegistry();
  const now = options.now ?? Date.now;
  const startedAt = now();

  const files: FileReport[] = [];
  const diagnostics: Diagnostic[] = [...(options.diagnostics ?? [])];

  for (const input of options.sources) {
    if (isProbablyBinary(input.content)) {
      diagnostics.push({
        path: input.path,
        level: "info",
        message: "skipped: binary file",
      });
      continue;
    }

    const source = decode(input.content);
    const analyzer = registry.resolve(input.path, source.slice(0, 1024));
    if (!analyzer) continue;

    try {
      const report = analyzer.analyze({
        path: input.path,
        source,
        language: analyzer.id,
      });
      report.violations = applyThresholds(report, config.thresholds);
      files.push(report);
    } catch (error) {
      diagnostics.push({
        path: input.path,
        level: "error",
        message: `analysis failed: ${describe(error)}`,
      });
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    toolVersion: options.toolVersion ?? toolVersion(),
    root: options.root,
    generatedAt: new Date(now()).toISOString(),
    durationMs: now() - startedAt,
    summary: summarize(files),
    files,
    diagnostics,
  };
}

const BINARY_SNIFF_BYTES = 8000;
const utf8Decoder = new TextDecoder("utf-8");

/** Heuristic: a NUL byte within the first few KB means "not source code". */
export function isProbablyBinary(content: Uint8Array | string): boolean {
  if (typeof content === "string") return false;
  const length = Math.min(content.length, BINARY_SNIFF_BYTES);
  for (let i = 0; i < length; i++) {
    if (content[i] === 0) return true;
  }
  return false;
}

function decode(content: Uint8Array | string): string {
  const text =
    typeof content === "string" ? content : utf8Decoder.decode(content);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function summarize(files: FileReport[]): Summary {
  const filesByLanguage: Record<string, number> = {};
  const loc: LocStats = {
    physical: 0,
    code: 0,
    comment: 0,
    blank: 0,
    logical: 0,
  };
  const violations: ViolationSummary = {
    total: 0,
    error: 0,
    warning: 0,
    info: 0,
  };
  const markers: Markers = { todo: 0, fixme: 0, hack: 0 };
  let maintainabilitySum = 0;

  for (const file of files) {
    filesByLanguage[file.language] = (filesByLanguage[file.language] ?? 0) + 1;
    loc.physical += file.loc.physical;
    loc.code += file.loc.code;
    loc.comment += file.loc.comment;
    loc.blank += file.loc.blank;
    loc.logical += file.loc.logical;
    markers.todo += file.markers.todo;
    markers.fixme += file.markers.fixme;
    markers.hack += file.markers.hack;
    maintainabilitySum += file.maintainability;
    for (const violation of file.violations) {
      violations.total++;
      violations[violation.level]++;
    }
  }

  return {
    files: files.length,
    filesByLanguage,
    loc,
    maintainability: files.length > 0 ? maintainabilitySum / files.length : 100,
    metrics: {
      cyclomatic: mergeDistributions(files.map((f) => f.metrics.cyclomatic)),
      cognitive: mergeDistributions(files.map((f) => f.metrics.cognitive)),
      nesting: mergeDistributions(files.map((f) => f.metrics.nesting)),
      functionLoc: mergeDistributions(files.map((f) => f.metrics.functionLoc)),
      params: mergeDistributions(files.map((f) => f.metrics.params)),
      maintainability: mergeDistributions(
        files.map((f) => f.metrics.maintainability),
      ),
      halsteadVolume: mergeDistributions(
        files.map((f) => f.metrics.halsteadVolume),
      ),
    },
    markers,
    violations,
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
