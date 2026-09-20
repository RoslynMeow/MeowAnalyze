export {
  DEFAULT_CONFIG,
  DEFAULT_THRESHOLDS,
  loadConfig,
  type Config,
  type Thresholds,
} from "./config.js";
export { analyze, type AnalyzeOptions } from "./core/engine.js";
export type { FileContext, LanguageAnalyzer } from "./lang/analyzer.js";
export { defaultRegistry, LanguageRegistry } from "./lang/registry.js";
export { TypeScriptAnalyzer } from "./lang/typescript.js";
export * from "./report/model.js";
export { toJson } from "./report/serialize.js";
export { renderReport, type TableOptions } from "./report/table.js";
