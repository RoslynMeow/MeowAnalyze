/**
 * Generic tree-sitter analyzer. Language-specific knowledge lives in an
 * `AnalyzerProfile` (node-type sets plus a few accessors), so adding a language
 * means writing a profile — not another analyzer. The output is the same
 * `FileReport` contract as the TypeScript analyzer, which keeps thresholds, the
 * dashboard, the CLI and the diagrams working unchanged.
 *
 * The grammar must be loaded before `analyze` runs (see `runtime.ts`); hosts
 * await `loadGrammar()` first, which keeps the analysis engine synchronous.
 */
import Parser from "web-tree-sitter";
import { distributionOf } from "../../metrics/distribution.js";
import { maintainabilityIndex } from "../../metrics/maintainability.js";
import type { FileContext, LanguageAnalyzer } from "../analyzer.js";
import type {
  DeclarationReport,
  FileReport,
  FlowNode,
  FunctionKind,
  FunctionReport,
  Halstead,
  ImportReport,
  LanguageId,
  LocStats,
  Markers,
  Range,
} from "../../report/model.js";
import { loadedGrammar, type TreeSitterGrammar } from "./runtime.js";

export type Node = Parser.SyntaxNode;

export interface FunctionShape {
  /** The whole function node (used for its source range). */
  node: Node;
  /** The body node (used for metrics). */
  body: Node;
  name: string;
  owner?: string;
  params: number;
  kind: FunctionKind;
}

export interface CognitiveRules {
  /** `if` (or equivalent) — scored `1 + nesting`. */
  ifTypes: ReadonlySet<string>;
  /** `else if` / `elif` clauses — scored a flat `1`. */
  elifTypes: ReadonlySet<string>;
  loopTypes: ReadonlySet<string>;
  switchTypes: ReadonlySet<string>;
  catchTypes: ReadonlySet<string>;
  ternaryTypes: ReadonlySet<string>;
  ifCondition(node: Node): Node | null;
  ifConsequence(node: Node): Node | null;
  ifAlternative(node: Node): Node | null;
  /** True when an `if` is the `else` branch of another `if` (flat score). */
  isElseIf(node: Node): boolean;
  /** True when the alternative is a plain `else` (scored `1`). */
  isPlainElse(node: Node): boolean;
  /** The operator token of a logical-operator node, or undefined. */
  logicalOperator(node: Node): string | undefined;
}

export interface AnalyzerProfile {
  functionTypes: ReadonlySet<string>;
  /** Resolve a function node to its name / owner / parameters / body. */
  functionShape(node: Node, enclosing: string | undefined): FunctionShape | undefined;

  decisionTypes: ReadonlySet<string>;
  /** Whether a logical-operator node adds to cyclomatic complexity. */
  logicalDecision(node: Node): boolean;
  nestingTypes: ReadonlySet<string>;
  statementTypes: ReadonlySet<string>;
  cognitive: CognitiveRules;

  operatorTypes: ReadonlySet<string>;
  operandTypes: ReadonlySet<string>;

  commentTypes: ReadonlySet<string>;

  importTypes: ReadonlySet<string>;
  importModule(node: Node): string | undefined;

  callTypes: ReadonlySet<string>;
  calleeName(node: Node): string | undefined;

  declarationTypes: ReadonlySet<string>;
  declaration(node: Node, path: string): DeclarationReport | undefined;

  /** Class-like nodes that give inline members/fields an owner. */
  containerTypes: ReadonlySet<string>;
  containerName(node: Node): string | undefined;

  /** Map a statement node to a control-flow node (activity diagram). */
  flowNode(node: Node): FlowNode | undefined;
}

/* ------------------------------------------------------------------ */
/* Node helpers                                                        */
/* ------------------------------------------------------------------ */

function positionRange(node: Node): Range {
  return {
    start: { line: node.startPosition.row + 1, column: node.startPosition.column + 1 },
    end: { line: node.endPosition.row + 1, column: node.endPosition.column + 1 },
  };
}

/** Visit a node tree; returning `false` from `visit` prunes that subtree. */
function walk(node: Node, visit: (node: Node) => boolean | void): void {
  if (visit(node) === false) return;
  for (const child of node.children) walk(child, visit);
}

function sum(map: Map<string, number>): number {
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}

/* ------------------------------------------------------------------ */
/* Lines of code                                                       */
/* ------------------------------------------------------------------ */

interface LocResult {
  stats: LocStats;
  /** 1-based line numbers that contain source code (not comment/blank). */
  code: ReadonlySet<number>;
}

function measureLoc(source: string, root: Node, profile: AnalyzerProfile): LocResult {
  const lines = source.split("\n");
  const physical = lines.length;
  const commentMask = new Uint8Array(source.length);

  walk(root, (node) => {
    if (!profile.commentTypes.has(node.type)) return;
    const end = Math.min(node.endIndex, commentMask.length);
    for (let index = node.startIndex; index < end; index++) commentMask[index] = 1;
  });

  const lineStart: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStart.push(offset);
    offset += line.length + 1; // + "\n"
  }

  const code = new Set<number>();
  let comment = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    let hasCode = false;
    let hasAny = false;
    for (let column = 0; column < line.length; column++) {
      const ch = line[column];
      if (ch === undefined || ch === " " || ch === "\t" || ch === "\r") continue;
      hasAny = true;
      if (commentMask[(lineStart[index] ?? 0) + column] !== 1) {
        hasCode = true;
        break;
      }
    }
    if (hasCode) code.add(index + 1);
    else if (hasAny) comment++;
  }

  let logical = 0;
  walk(root, (node) => {
    if (profile.statementTypes.has(node.type)) logical++;
  });

  return {
    stats: {
      physical,
      code: code.size,
      comment,
      blank: physical - code.size - comment,
      logical,
    },
    code,
  };
}

function codeLinesIn(code: ReadonlySet<number>, range: Range): number {
  let count = 0;
  for (let line = range.start.line; line <= range.end.line; line++) {
    if (code.has(line)) count++;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* Complexity                                                          */
/* ------------------------------------------------------------------ */

function cyclomatic(body: Node, profile: AnalyzerProfile): number {
  let complexity = 1;
  walk(body, (node) => {
    if (node !== body && profile.functionTypes.has(node.type)) return false;
    if (profile.decisionTypes.has(node.type)) {
      complexity++;
      return;
    }
    if (profile.logicalDecision(node)) complexity++;
  });
  return complexity;
}

function maxNesting(body: Node, profile: AnalyzerProfile): number {
  let max = 0;
  const visit = (node: Node, depth: number): void => {
    if (node !== body && profile.functionTypes.has(node.type)) return;
    const next = profile.nestingTypes.has(node.type) ? depth + 1 : depth;
    if (next > max) max = next;
    for (const child of node.children) visit(child, next);
  };
  visit(body, 0);
  return max;
}

function cognitiveComplexity(body: Node, profile: AnalyzerProfile): number {
  const rules = profile.cognitive;
  let score = 0;

  const descend = (node: Node, nesting: number): void => {
    for (const child of node.children) {
      if (profile.functionTypes.has(child.type)) continue;
      visit(child, nesting);
    }
  };

  const scoreScoped = (node: Node, nesting: number, skip: Node | null): void => {
    score += 1 + nesting;
    for (const child of node.children) {
      if (profile.functionTypes.has(child.type) || child === skip) continue;
      visit(child, nesting + 1);
    }
  };

  const visit = (node: Node, nesting: number): void => {
    const type = node.type;

    if (rules.ifTypes.has(type)) {
      const isElseIf = rules.isElseIf(node);
      score += isElseIf ? 1 : 1 + nesting;
      const inner = isElseIf ? nesting : nesting + 1;
      const condition = rules.ifCondition(node);
      if (condition) visit(condition, nesting);
      const consequence = rules.ifConsequence(node);
      if (consequence) visit(consequence, inner);
      const alternative = rules.ifAlternative(node);
      if (alternative) {
        if (rules.isPlainElse(node)) score += 1;
        visit(alternative, inner);
      }
      return;
    }

    if (rules.elifTypes.has(type)) {
      score += 1;
      const condition = rules.ifCondition(node);
      if (condition) visit(condition, nesting);
      const consequence = rules.ifConsequence(node);
      if (consequence) visit(consequence, nesting + 1);
      const alternative = rules.ifAlternative(node);
      if (alternative) visit(alternative, nesting + 1);
      return;
    }

    if (rules.loopTypes.has(type) || rules.switchTypes.has(type)) {
      scoreScoped(node, nesting, null);
      return;
    }

    if (rules.catchTypes.has(type)) {
      score += 1 + nesting;
      descend(node, nesting + 1);
      return;
    }

    if (rules.ternaryTypes.has(type)) {
      score += 1 + nesting;
      descend(node, nesting + 1);
      return;
    }

    if (profile.functionTypes.has(type)) return;

    const operator = rules.logicalOperator(node);
    if (operator) {
      const parentOperator = node.parent ? rules.logicalOperator(node.parent) : undefined;
      if (parentOperator !== operator) score += 1;
      descend(node, nesting);
      return;
    }

    descend(node, nesting);
  };

  visit(body, 0);
  return score;
}

/* ------------------------------------------------------------------ */
/* Halstead                                                            */
/* ------------------------------------------------------------------ */

function halsteadOf(body: Node, profile: AnalyzerProfile): Halstead {
  const operators = new Map<string, number>();
  const operands = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string): void => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  walk(body, (node) => {
    if (node !== body && profile.functionTypes.has(node.type)) return false;
    if (profile.operatorTypes.has(node.type)) {
      bump(operators, node.childForFieldName("operator")?.text ?? node.type);
    } else if (profile.operandTypes.has(node.type)) {
      bump(operands, node.text);
    }
  });

  const distinctOperators = operators.size;
  const distinctOperands = operands.size;
  const totalOperators = sum(operators);
  const totalOperands = sum(operands);
  const vocabulary = distinctOperators + distinctOperands;
  const length = totalOperators + totalOperands;
  const volume = vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
  const difficulty =
    distinctOperands > 0
      ? (distinctOperators / 2) * (totalOperands / distinctOperands)
      : 0;

  return {
    distinctOperators,
    distinctOperands,
    totalOperators,
    totalOperands,
    vocabulary,
    length,
    volume,
    difficulty,
    effort: difficulty * volume,
  };
}

/* ------------------------------------------------------------------ */
/* Imports / calls / declarations                                      */
/* ------------------------------------------------------------------ */

function collectImports(root: Node, profile: AnalyzerProfile): ImportReport[] {
  const imports: ImportReport[] = [];
  walk(root, (node) => {
    if (!profile.importTypes.has(node.type)) return;
    const module = profile.importModule(node);
    if (module) imports.push({ module, names: [], typeOnly: false });
  });
  return imports;
}

function collectCalls(body: Node, profile: AnalyzerProfile): string[] {
  const names = new Set<string>();
  walk(body, (node) => {
    if (!profile.callTypes.has(node.type)) return;
    const name = profile.calleeName(node);
    if (name) names.add(name);
  });
  return [...names];
}

function countMarkers(comments: readonly string[]): Markers {
  const markers: Markers = { todo: 0, fixme: 0, hack: 0 };
  for (const comment of comments) {
    for (const match of comment.matchAll(/\b(TODO|FIXME|HACK)\b/g)) {
      const kind = match[1]?.toLowerCase();
      if (kind === "todo") markers.todo++;
      else if (kind === "fixme") markers.fixme++;
      else if (kind === "hack") markers.hack++;
    }
  }
  return markers;
}

/* ------------------------------------------------------------------ */
/* Control flow (activity diagram)                                     */
/* ------------------------------------------------------------------ */

function buildFlow(body: Node, profile: AnalyzerProfile): FlowNode[] {
  const out: FlowNode[] = [];
  for (const statement of body.namedChildren) {
    const node = profile.flowNode(statement);
    if (node) out.push(node);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Analyzer                                                            */
/* ------------------------------------------------------------------ */

export class TreeSitterAnalyzer implements LanguageAnalyzer {
  constructor(
    readonly id: LanguageId,
    private readonly grammar: TreeSitterGrammar,
    readonly extensions: readonly string[],
    private readonly profile: AnalyzerProfile,
  ) {}

  matches(path: string, _head: string): boolean {
    const lower = path.toLowerCase();
    return this.extensions.some((extension) => lower.endsWith(extension));
  }

  analyze(ctx: FileContext): FileReport {
    const language = loadedGrammar(this.grammar);
    if (!language) {
      throw new Error(
        `the ${this.grammar} grammar is not loaded; call loadGrammar("${this.grammar}") before analyzing`,
      );
    }

    const parser = new Parser();
    parser.setLanguage(language);
    const tree = parser.parse(ctx.source);
    const root = tree.rootNode;

    const loc = measureLoc(ctx.source, root, this.profile);
    const functions = this.collectFunctions(root, ctx.path, loc.code);
    const declarations = this.collectDeclarations(root, ctx.path);
    const imports = collectImports(root, this.profile);

    const comments: string[] = [];
    walk(root, (node) => {
      if (this.profile.commentTypes.has(node.type)) comments.push(node.text);
    });

    const totalVolume = functions.reduce((total, fn) => total + fn.halstead.volume, 0);
    const totalCyclomatic = functions.reduce((total, fn) => total + fn.cyclomatic, 0);

    const report: FileReport = {
      path: ctx.path,
      language: this.id,
      loc: loc.stats,
      maintainability: maintainabilityIndex(totalVolume, totalCyclomatic, loc.stats.code),
      metrics: {
        cyclomatic: distributionOf(functions.map((fn) => fn.cyclomatic)),
        cognitive: distributionOf(functions.map((fn) => fn.cognitive)),
        nesting: distributionOf(functions.map((fn) => fn.maxNesting)),
        functionLoc: distributionOf(functions.map((fn) => fn.loc)),
        params: distributionOf(functions.map((fn) => fn.params)),
        maintainability: distributionOf(functions.map((fn) => fn.maintainability)),
        halsteadVolume: distributionOf(functions.map((fn) => fn.halstead.volume)),
        halsteadDifficulty: distributionOf(functions.map((fn) => fn.halstead.difficulty)),
        halsteadEffort: distributionOf(functions.map((fn) => fn.halstead.effort)),
      },
      markers: countMarkers(comments),
      functions,
      declarations,
      imports,
      violations: [],
    };

    tree.delete();
    parser.delete();
    return report;
  }

  private collectFunctions(
    root: Node,
    path: string,
    code: ReadonlySet<number>,
  ): FunctionReport[] {
    const out: FunctionReport[] = [];

    const visit = (node: Node, enclosing: string | undefined): void => {
      let owner = enclosing;
      if (this.profile.containerTypes.has(node.type)) {
        owner = this.profile.containerName(node) ?? enclosing;
      }

      if (this.profile.functionTypes.has(node.type)) {
        const shape = this.profile.functionShape(node, owner);
        if (shape) {
          out.push(this.functionReport(shape, path, code));
          return; // do not descend into the body for nested ownership
        }
      }

      for (const child of node.children) visit(child, owner);
    };

    visit(root, undefined);
    return out;
  }

  private functionReport(
    shape: FunctionShape,
    path: string,
    code: ReadonlySet<number>,
  ): FunctionReport {
    const range = positionRange(shape.node);
    const body = shape.body;
    const halstead = halsteadOf(body, this.profile);
    const complexity = cyclomatic(body, this.profile);
    const lines = codeLinesIn(code, range);
    const owner = shape.owner;

    return {
      id: `${path}:${range.start.line}:${shape.name}`,
      name: shape.name,
      ...(owner ? { owner } : {}),
      kind: shape.kind,
      range,
      loc: lines,
      params: shape.params,
      cyclomatic: complexity,
      cognitive: cognitiveComplexity(body, this.profile),
      maxNesting: maxNesting(body, this.profile),
      halstead,
      maintainability: maintainabilityIndex(halstead.volume, complexity, lines),
      calls: collectCalls(body, this.profile),
      flow: buildFlow(body, this.profile),
    };
  }

  private collectDeclarations(root: Node, path: string): DeclarationReport[] {
    const out: DeclarationReport[] = [];
    walk(root, (node) => {
      if (!this.profile.declarationTypes.has(node.type)) return;
      const declaration = this.profile.declaration(node, path);
      if (declaration) out.push(declaration);
    });
    return out;
  }
}
