import { promises as fs } from "node:fs";
import path from "node:path";
import {
  analyzeSources,
  DEFAULT_CONFIG,
  toolVersion,
  type AnalysisReport,
  type Config,
  type Diagnostic,
  type LanguageRegistry,
  type SourceInput,
} from "@meowanalyze/core";
import { walkFiles, type WalkedFile } from "./walk.js";

export interface AnalyzeOptions {
  /** Directory or single file to analyze. */
  root: string;
  config?: Config;
  registry?: LanguageRegistry;
}

/**
 * Node host: walks the filesystem, reads files, then hands plain in-memory
 * sources to the platform-agnostic core (`analyzeSources`). Swapping this for a
 * browser/zip host is all that a UI needs.
 */
export async function analyze(
  options: AnalyzeOptions,
): Promise<AnalysisReport> {
  const root = path.resolve(options.root);
  const config = options.config ?? DEFAULT_CONFIG;

  const walked = await collectTargets(root, config);

  const sources: SourceInput[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const entry of walked) {
    try {
      const content = await fs.readFile(entry.absPath);
      sources.push({ path: entry.relPath, content });
    } catch (error) {
      diagnostics.push({
        path: entry.relPath,
        level: "error",
        message: `could not read file: ${describe(error)}`,
      });
    }
  }

  return analyzeSources({
    root,
    sources,
    config,
    diagnostics,
    registry: options.registry,
    toolVersion: toolVersion(),
  });
}

/** Accept either a directory (walked + filtered) or a single file. */
async function collectTargets(
  root: string,
  config: Config,
): Promise<WalkedFile[]> {
  try {
    const stat = await fs.stat(root);
    if (stat.isFile()) {
      return [{ absPath: root, relPath: path.basename(root), size: stat.size }];
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

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
