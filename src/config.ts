import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseToml } from "smol-toml";

export interface Thresholds {
  /** Max cyclomatic complexity per function. */
  cyclomatic: number;
  /** Max nesting depth per function. */
  nesting: number;
  /** Max parameters per function. */
  params: number;
  /** Max physical lines per function. */
  functionLoc: number;
  /** Max physical lines per file. */
  fileLoc: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  cyclomatic: 10,
  nesting: 4,
  params: 5,
  functionLoc: 80,
  fileLoc: 1000,
};

export interface Config {
  thresholds: Thresholds;
  respectGitignore: boolean;
  exclude: string[];
  maxFileSize: number;
}

export const DEFAULT_CONFIG: Config = {
  thresholds: { ...DEFAULT_THRESHOLDS },
  respectGitignore: true,
  exclude: [],
  maxFileSize: 2 * 1024 * 1024,
};

export const CONFIG_FILENAMES = ["meowanalyze.toml", ".meowanalyze.toml"];

/** Load config from an explicit file, or auto-discover one in `root`. */
export async function loadConfig(
  file: string | undefined,
  root: string,
): Promise<Config> {
  const resolved = file ? path.resolve(file) : await discover(root);
  if (!resolved) return cloneDefault();

  const text = await readFile(resolved, "utf8");
  return mergeConfig(parseToml(text) as Record<string, unknown>);
}

async function discover(root: string): Promise<string | undefined> {
  for (const name of CONFIG_FILENAMES) {
    const candidate = path.join(root, name);
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch {
      // try next
    }
  }
  return undefined;
}

function mergeConfig(raw: Record<string, unknown>): Config {
  const config = cloneDefault();

  const thresholds = raw["thresholds"];
  if (isRecord(thresholds)) {
    config.thresholds.cyclomatic = pickNumber(
      thresholds["cyclomatic"],
      config.thresholds.cyclomatic,
    );
    config.thresholds.nesting = pickNumber(
      thresholds["nesting"],
      config.thresholds.nesting,
    );
    config.thresholds.params = pickNumber(
      thresholds["params"],
      config.thresholds.params,
    );
    config.thresholds.functionLoc = pickNumber(
      thresholds["function_loc"],
      config.thresholds.functionLoc,
    );
    config.thresholds.fileLoc = pickNumber(
      thresholds["file_loc"],
      config.thresholds.fileLoc,
    );
  }

  const analysis = raw["analysis"];
  if (isRecord(analysis)) {
    if (typeof analysis["gitignore"] === "boolean") {
      config.respectGitignore = analysis["gitignore"];
    }
    if (Array.isArray(analysis["exclude"])) {
      config.exclude = analysis["exclude"].filter(
        (item): item is string => typeof item === "string",
      );
    }
    config.maxFileSize = pickNumber(
      analysis["max_file_size"],
      config.maxFileSize,
    );
  }

  return config;
}

function cloneDefault(): Config {
  return {
    thresholds: { ...DEFAULT_THRESHOLDS },
    respectGitignore: DEFAULT_CONFIG.respectGitignore,
    exclude: [...DEFAULT_CONFIG.exclude],
    maxFileSize: DEFAULT_CONFIG.maxFileSize,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
