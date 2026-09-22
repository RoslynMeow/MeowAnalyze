/**
 * Pure configuration model — no filesystem, safe for browser/WASM builds.
 * Loading a config file lives in `./load.ts` (Node only).
 */

import type { LanguageId } from "../report/model.js";

export interface Thresholds {
  /** Max cyclomatic complexity per function. */
  cyclomatic: number;
  /** Max cognitive complexity per function. */
  cognitive: number;
  /** Max nesting depth per function. */
  nesting: number;
  /** Max parameters per function. */
  params: number;
  /** Max code lines per function. */
  functionLoc: number;
  /** Max code lines per file. */
  fileLoc: number;
}

/**
 * Global fallback. Values follow the common conventions: cyclomatic 15 and
 * cognitive 15 (Sonar), nesting 4 (ESLint `max-depth`), params 7 (Sonar).
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  cyclomatic: 15,
  cognitive: 15,
  nesting: 4,
  params: 7,
  functionLoc: 100,
  fileLoc: 1000,
};

/**
 * Per-language defaults. TypeScript and JavaScript share one profile today;
 * new (tree-sitter) languages can diverge here without touching any caller.
 */
export const DEFAULT_THRESHOLDS_BY_LANGUAGE: Readonly<Record<LanguageId, Thresholds>> = {
  typescript: DEFAULT_THRESHOLDS,
  javascript: DEFAULT_THRESHOLDS,
};

/** Defaults for a language, falling back to the global profile. */
export function defaultThresholds(language?: LanguageId): Thresholds {
  return (language && DEFAULT_THRESHOLDS_BY_LANGUAGE[language]) || DEFAULT_THRESHOLDS;
}

/**
 * Language defaults with explicit overrides applied on top; only the keys the
 * caller set win, so a partial override keeps the rest of the profile.
 */
export function resolveThresholds(
  language: LanguageId | undefined,
  overrides?: Partial<Thresholds>,
): Thresholds {
  return { ...defaultThresholds(language), ...(overrides ?? {}) };
}

export interface Config {
  /** Explicit threshold overrides; unset fields fall back per language. */
  thresholds: Partial<Thresholds>;
  respectGitignore: boolean;
  exclude: string[];
  maxFileSize: number;
}

export const DEFAULT_CONFIG: Config = {
  thresholds: {},
  respectGitignore: true,
  exclude: [],
  maxFileSize: 2 * 1024 * 1024,
};
