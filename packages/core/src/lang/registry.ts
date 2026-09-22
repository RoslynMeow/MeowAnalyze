import type { LanguageAnalyzer } from "./analyzer.js";
import { TreeSitterAnalyzer } from "./tree-sitter/analyzer.js";
import { C_CPP_PROFILE } from "./tree-sitter/c-profile.js";
import { CSHARP_PROFILE } from "./tree-sitter/csharp-profile.js";
import { JAVA_PROFILE } from "./tree-sitter/java-profile.js";
import { PYTHON_PROFILE } from "./tree-sitter/python-profile.js";
import { loadAllGrammars } from "./tree-sitter/runtime.js";
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

/** C is registered before C++, so `.h` headers resolve to C by default. */
const C_ANALYZER = new TreeSitterAnalyzer("c", "c", [".c", ".h"], C_CPP_PROFILE);
const CPP_ANALYZER = new TreeSitterAnalyzer(
  "cpp",
  "cpp",
  [".cc", ".cpp", ".cxx", ".c++", ".hpp", ".hh", ".hxx", ".ipp", ".tpp", ".inl"],
  C_CPP_PROFILE,
);
const PYTHON_ANALYZER = new TreeSitterAnalyzer(
  "python",
  "python",
  [".py", ".pyi"],
  PYTHON_PROFILE,
);
const JAVA_ANALYZER = new TreeSitterAnalyzer("java", "java", [".java"], JAVA_PROFILE);
const CSHARP_ANALYZER = new TreeSitterAnalyzer(
  "csharp",
  "csharp",
  [".cs"],
  CSHARP_PROFILE,
);

/**
 * TypeScript / JavaScript only. Synchronous, so `analyzeSources` keeps working
 * without any async setup — used by tests and lightweight callers.
 */
export function defaultRegistry(): LanguageRegistry {
  return new LanguageRegistry().register(new TypeScriptAnalyzer());
}

/**
 * Every language, with the tree-sitter grammars loaded. Hosts (CLI, web,
 * desktop) await this once and pass it to `analyzeSources`.
 */
export async function defaultRegistryWithLanguages(): Promise<LanguageRegistry> {
  await loadAllGrammars();
  return new LanguageRegistry()
    .register(new TypeScriptAnalyzer())
    .register(C_ANALYZER)
    .register(CPP_ANALYZER)
    .register(PYTHON_ANALYZER)
    .register(JAVA_ANALYZER)
    .register(CSHARP_ANALYZER);
}
