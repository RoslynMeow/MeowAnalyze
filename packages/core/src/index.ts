/**
 * Public API of the browser-safe analysis core.
 *
 * This package performs no filesystem or process I/O, so it runs unchanged in
 * Node, the browser and WASM. Hosts feed it in-memory sources via
 * `analyzeSources` and consume the resulting `AnalysisReport`.
 */
export * from "./report/model.js";
export { toJson } from "./report/serialize.js";
export {
  analyzeSources,
  isProbablyBinary,
  type AnalyzeSourcesOptions,
  type SourceInput,
} from "./core/analyze.js";
export { applyThresholds } from "./core/thresholds.js";
export {
  DEFAULT_CONFIG,
  DEFAULT_THRESHOLDS,
  DEFAULT_THRESHOLDS_BY_LANGUAGE,
  defaultThresholds,
  resolveThresholds,
  type Config,
  type Thresholds,
} from "./config/thresholds.js";
export {
  emptyDistribution,
  distributionOf,
  mergeDistributions,
} from "./metrics/distribution.js";
export type { FileContext, LanguageAnalyzer } from "./lang/analyzer.js";
export {
  defaultRegistry,
  defaultRegistryWithLanguages,
  LanguageRegistry,
} from "./lang/registry.js";
export { TypeScriptAnalyzer } from "./lang/typescript.js";
export {
  loadAllGrammars,
  loadGrammar,
  type TreeSitterGrammar,
} from "./lang/tree-sitter/runtime.js";
export { TOOL_VERSION, toolVersion } from "./version.js";
