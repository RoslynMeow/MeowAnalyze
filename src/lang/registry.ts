import type { LanguageAnalyzer } from "./analyzer.js";
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

export function defaultRegistry(): LanguageRegistry {
  return new LanguageRegistry().register(new TypeScriptAnalyzer());
}
