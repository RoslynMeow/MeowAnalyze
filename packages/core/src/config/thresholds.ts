/**
 * Pure configuration model — no filesystem, safe for browser/WASM builds.
 * Loading a config file lives in `./load.ts` (Node only).
 */

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
