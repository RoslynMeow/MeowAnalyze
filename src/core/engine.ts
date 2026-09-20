import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG, type Config } from "../config.js";
import { defaultRegistry, type LanguageRegistry } from "../lang/registry.js";
import { mergeDistributions } from "../metrics/distribution.js";
import {
  SCHEMA_VERSION,
  type AnalysisReport,
  type Diagnostic,
  type FileReport,
  type LocStats,
  type Summary,
  type ViolationSummary,
} from "../report/model.js";
import { toolVersion } from "../version.js";
import { applyThresholds } from "./thresholds.js";
import { walkFiles, type WalkedFile } from "./walk.js";

export interface AnalyzeOptions {
  /** Directory or single file to analyze. */
  root: string;
  config?: Config;
  registry?: LanguageRegistry;
}

/**
 * Orchestrates the pipeline: walk -> detect language -> analyze -> apply
 * thresholds -> aggregate. A failing file never aborts the run; it becomes a
 * diagnostic instead.
 */
export async function analyze(
  options: AnalyzeOptions,
): Promise<AnalysisReport> {
  const root = path.resolve(options.root);
  const config = options.config ?? DEFAULT_CONFIG;
  const registry = options.registry ?? defaultRegistry();
  const startedAt = Date.now();

  const walked = await collectTargets(root, config);

  const files: FileReport[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const entry of walked) {
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(entry.absPath);
    } catch (error) {
      diagnostics.push({
        path: entry.relPath,
        level: "error",
        message: `could not read file: ${describe(error)}`,
      });
      continue;
    }

    if (isBinary(buffer)) {
      diagnostics.push({
        path: entry.relPath,
        level: "info",
        message: "skipped: binary file",
      });
      continue;
    }

    const source = stripBom(buffer.toString("utf8"));
    const analyzer = registry.resolve(entry.relPath, source.slice(0, 1024));
    if (!analyzer) continue;

    try {
      const report = analyzer.analyze({
        path: entry.relPath,
        source,
        language: analyzer.id,
      });
      report.violations = applyThresholds(report, config.thresholds);
      files.push(report);
    } catch (error) {
      diagnostics.push({
        path: entry.relPath,
        level: "error",
        message: `analysis failed: ${describe(error)}`,
      });
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    toolVersion: toolVersion(),
    root,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    summary: summarize(files),
    files,
    diagnostics,
  };
}

/** Accept either a directory (walked + filtered) or a single file. */
async function collectTargets(
  root: string,
  config: Config,
): Promise<WalkedFile[]> {
  try {
    const stat = await fs.stat(root);
    if (stat.isFile()) {
      return [
        { absPath: root, relPath: path.basename(root), size: stat.size },
      ];
    }
  } catch {
    return [];
  }
  return walkFiles({
    root,
    respectGitignore: config.respectGitignore,
    exclude: config.exclude,
    maxFileSize: config.maxFileSize,
  });
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

  for (const file of files) {
    filesByLanguage[file.language] = (filesByLanguage[file.language] ?? 0) + 1;
    loc.physical += file.loc.physical;
    loc.code += file.loc.code;
    loc.comment += file.loc.comment;
    loc.blank += file.loc.blank;
    loc.logical += file.loc.logical;
    for (const violation of file.violations) {
      violations.total++;
      violations[violation.level]++;
    }
  }

  return {
    files: files.length,
    filesByLanguage,
    loc,
    metrics: {
      cyclomatic: mergeDistributions(files.map((f) => f.metrics.cyclomatic)),
      nesting: mergeDistributions(files.map((f) => f.metrics.nesting)),
      functionLoc: mergeDistributions(files.map((f) => f.metrics.functionLoc)),
      params: mergeDistributions(files.map((f) => f.metrics.params)),
    },
    violations,
  };
}

function isBinary(buffer: Buffer): boolean {
  const length = Math.min(buffer.length, 8000);
  for (let i = 0; i < length; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
