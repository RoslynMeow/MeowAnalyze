import type { LanguageAnalyzer } from "./analyzer.js";
import { TreeSitterAnalyzer } from "./tree-sitter/analyzer.js";
import { TREE_SITTER_LANGUAGES } from "./tree-sitter/languages.js";
import { loadGrammar } from "./tree-sitter/runtime.js";
import { TypeScriptAnalyzer } from "./typescript.js";

/**
 * Ordered list of language front-ends. The first analyzer whose `matches`
 * returns true claims the file, so register broader/more-specific analyzers
 * deliberately.
 */
export class LanguageRegistry {
  private readonly analyzers: LanguageAnalyzer[] = [];

  register(analyzer: LanguageAnalyzer): this {
    this.analyzers.push(analyzer);
    return this;
  }

  /** Returns the analyzer for a path, or undefined when no language matches. */
  resolve(path: string, head: string): LanguageAnalyzer | undefined {
    return this.analyzers.find((analyzer) => analyzer.matches(path, head));
  }

  list(): readonly LanguageAnalyzer[] {
    return this.analyzers;
  }
}

const TREE_SITTER_ANALYZERS = TREE_SITTER_LANGUAGES.map((language) => ({
  grammar: language.grammar,
  analyzer: new TreeSitterAnalyzer(
    language.id,
    language.grammar,
    language.extensions,
    language.profile,
  ),
}));

/**
 * TypeScript / JavaScript only. Synchronous, so `analyzeSources` keeps working
 * without any async setup — used by tests and lightweight callers.
 */
export function defaultRegistry(): LanguageRegistry {
  return new LanguageRegistry().register(new TypeScriptAnalyzer());
}

/**
 * Build a registry for the given files, loading only the grammars they need.
 * A TS/JS-only project loads no wasm at all, and a project with several
 * languages only pays for those. Grammars are cached, so repeated calls are
 * cheap. Hosts (CLI, web, desktop) await this before `analyzeSources`.
 */
export async function registryForPaths(
  paths: readonly string[],
): Promise<LanguageRegistry> {
  const needed = TREE_SITTER_ANALYZERS.filter(({ analyzer }) =>
    paths.some((path) => analyzer.matches(path, "")),
  );
  await Promise.all(needed.map(({ grammar }) => loadGrammar(grammar)));

  const registry = new LanguageRegistry().register(new TypeScriptAnalyzer());
  for (const { analyzer } of needed) registry.register(analyzer);
  return registry;
}
