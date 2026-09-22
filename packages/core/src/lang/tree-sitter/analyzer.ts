/**
 * C / C++ analyzer built on tree-sitter (WASM). It fills the same `FileReport`
 * contract as the TypeScript analyzer, so thresholds, the dashboard, the CLI
 * table and the diagrams all keep working unchanged.
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
  FlowBranch,
  FlowNode,
  FunctionKind,
  FunctionReport,
  Halstead,
  ImportReport,
  LanguageId,
  LocStats,
  Markers,
  MemberReport,
  Position,
  Range,
} from "../../report/model.js";
import { loadedGrammar, type TreeSitterGrammar } from "./runtime.js";

type Node = Parser.SyntaxNode;

const LOGICAL_OPERATORS = new Set(["&&", "||"]);

const NESTING_TYPES = new Set([
  "if_statement",
  "for_statement",
  "for_range_loop",
  "while_statement",
  "do_statement",
  "switch_statement",
  "try_statement",
  "catch_clause",
]);

const DECISION_TYPES = new Set([
  "if_statement",
  "for_statement",
  "for_range_loop",
  "while_statement",
  "do_statement",
  "case_statement",
  "conditional_expression",
  "catch_clause",
]);

const LOOP_TYPES = new Set([
  "for_statement",
  "for_range_loop",
  "while_statement",
  "do_statement",
]);

const STATEMENT_TYPES = new Set([
  "declaration",
  "expression_statement",
  "return_statement",
  "if_statement",
  "for_statement",
  "for_range_loop",
  "while_statement",
  "do_statement",
  "switch_statement",
  "case_statement",
  "break_statement",
  "continue_statement",
  "goto_statement",
  "labeled_statement",
  "try_statement",
  "throw_statement",
]);

const OPERATOR_TYPES = new Set([
  "binary_expression",
  "unary_expression",
  "update_expression",
  "assignment_expression",
  "pointer_expression",
  "conditional_expression",
  "subscript_expression",
  "field_expression",
  "call_expression",
  "new_expression",
  "delete_expression",
  "sizeof_expression",
  "cast_expression",
]);

const OPERAND_TYPES = new Set([
  "identifier",
  "field_identifier",
  "type_identifier",
  "namespace_identifier",
  "number_literal",
  "string_literal",
  "char_literal",
  "true",
  "false",
  "null",
  "nullptr",
  "this",
]);

const MARKER_PATTERN = /\b(TODO|FIXME|HACK)\b/g;

/* ------------------------------------------------------------------ */
/* Node helpers                                                        */
/* ------------------------------------------------------------------ */

function positionOf(node: Node, start: boolean): Position {
  const point = start ? node.startPosition : node.endPosition;
  return { line: point.row + 1, column: point.column + 1 };
}

function rangeOf(node: Node): Range {
  return { start: positionOf(node, true), end: positionOf(node, false) };
}

/** Visit a node tree; returning `false` from `visit` prunes that subtree. */
function walk(node: Node, visit: (node: Node) => boolean | void): void {
  if (visit(node) === false) return;
  for (const child of node.children) walk(child, visit);
}

function isFunctionNode(node: Node): boolean {
  return node.type === "function_definition" || node.type === "lambda_expression";
}

function firstLine(text: string, max = 60): string {
  const line = text.split("\n", 1)[0]?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
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

function measureLoc(source: string, root: Node): LocResult {
  const lines = source.split("\n");
  const physical = lines.length;
  const commentMask = new Uint8Array(source.length);

  walk(root, (node) => {
    if (node.type !== "comment") return;
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
    if (STATEMENT_TYPES.has(node.type)) logical++;
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

function cyclomatic(body: Node): number {
  let complexity = 1;
  walk(body, (node) => {
    if (node !== body && isFunctionNode(node)) return false;
    if (DECISION_TYPES.has(node.type)) {
      complexity++;
      return;
    }
    if (node.type === "binary_expression") {
      const operator = node.childForFieldName("operator")?.text;
      if (operator && LOGICAL_OPERATORS.has(operator)) complexity++;
    }
  });
  return complexity;
}

function maxNesting(body: Node): number {
  let max = 0;
  const visit = (node: Node, depth: number): void => {
    if (node !== body && isFunctionNode(node)) return;
    const next = NESTING_TYPES.has(node.type) ? depth + 1 : depth;
    if (next > max) max = next;
    for (const child of node.children) visit(child, next);
  };
  visit(body, 0);
  return max;
}

function cognitiveComplexity(body: Node): number {
  let score = 0;

  const descend = (node: Node, nesting: number): void => {
    for (const child of node.children) {
      if (isFunctionNode(child)) continue;
      visit(child, nesting);
    }
  };

  const visit = (node: Node, nesting: number): void => {
    const type = node.type;

    if (type === "if_statement") {
      const isElseIf = node.parent?.type === "else_clause";
      score += isElseIf ? 1 : 1 + nesting;
      const inner = isElseIf ? nesting : nesting + 1;
      const condition = node.childForFieldName("condition");
      if (condition) visit(condition, nesting);
      const consequence = node.childForFieldName("consequence");
      if (consequence) visit(consequence, inner);
      const alternative = node.childForFieldName("alternative");
      if (alternative) {
        const only = alternative.namedChildren;
        if (only.length === 1 && only[0]?.type === "if_statement") {
          visit(only[0], inner);
        } else {
          score += 1;
          visit(alternative, inner);
        }
      }
      return;
    }

    if (LOOP_TYPES.has(type) || type === "switch_statement") {
      score += 1 + nesting;
      descend(node, nesting + 1);
      return;
    }

    if (type === "catch_clause" || type === "conditional_expression") {
      score += 1 + nesting;
      descend(node, nesting + 1);
      return;
    }

    if (type === "binary_expression") {
      const operator = node.childForFieldName("operator")?.text;
      if (operator && LOGICAL_OPERATORS.has(operator)) {
        const parent = node.parent;
        const sameAsParent =
          parent?.type === "binary_expression" &&
          parent.childForFieldName("operator")?.text === operator;
        if (!sameAsParent) score += 1;
        descend(node, nesting);
        return;
      }
    }

    if (isFunctionNode(node)) return;
    descend(node, nesting);
  };

  visit(body, 0);
  return score;
}

/* ------------------------------------------------------------------ */
/* Halstead                                                            */
/* ------------------------------------------------------------------ */

function halsteadOf(body: Node): Halstead {
  const operators = new Map<string, number>();
  const operands = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string): void => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  walk(body, (node) => {
    if (node !== body && isFunctionNode(node)) return false;
    if (OPERATOR_TYPES.has(node.type)) {
      bump(operators, node.childForFieldName("operator")?.text ?? node.type);
    } else if (OPERAND_TYPES.has(node.type)) {
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
/* Functions                                                           */
/* ------------------------------------------------------------------ */

function unwrapDeclarator(node: Node | null): Node | null {
  let declarator = node;
  while (
    declarator &&
    (declarator.type === "pointer_declarator" ||
      declarator.type === "reference_declarator" ||
      declarator.type === "parenthesized_declarator")
  ) {
    declarator = declarator.childForFieldName("declarator");
  }
  return declarator;
}

function declaratorName(node: Node): { name: string; owner?: string } {
  const declarator = unwrapDeclarator(node.childForFieldName("declarator"));
  const target =
    declarator?.type === "function_declarator"
      ? declarator.childForFieldName("declarator")
      : declarator;
  const text = target?.text ?? "<anonymous>";
  const separator = text.lastIndexOf("::");
  if (separator === -1) return { name: text };
  return { name: text.slice(separator + 2), owner: text.slice(0, separator) };
}

/** First identifier-ish name in a declarator subtree (fields, variables). */
function simpleName(node: Node): string {
  let name = "";
  walk(node, (child) => {
    if (name) return false;
    if (
      child.type === "identifier" ||
      child.type === "field_identifier" ||
      child.type === "type_identifier"
    ) {
      name = child.text;
      return false;
    }
  });
  return name;
}

function parameterCount(node: Node): number {
  const declarator = unwrapDeclarator(node.childForFieldName("declarator"));
  const list =
    declarator?.type === "function_declarator"
      ? declarator.childForFieldName("parameters")
      : null;
  if (!list || list.namedChildCount === 0) return 0;
  if (list.namedChildCount === 1 && list.namedChildren[0]?.text === "void") return 0;
  return list.namedChildCount;
}

/* ------------------------------------------------------------------ */
/* Control-flow tree (activity diagram)                                */
/* ------------------------------------------------------------------ */

function buildFlow(body: Node): FlowNode[] {
  const out: FlowNode[] = [];
  for (const statement of body.namedChildren) {
    const node = toFlow(statement);
    if (node) out.push(node);
  }
  return out;
}

function toFlow(node: Node): FlowNode | undefined {
  switch (node.type) {
    case "if_statement": {
      const branches: FlowBranch[] = [
        { label: "then", body: bodyOf(node.childForFieldName("consequence")) },
      ];
      const alternative = node.childForFieldName("alternative");
      if (alternative) branches.push({ label: "else", body: bodyOf(alternative) });
      return { kind: "decision", branches };
    }
    case "switch_statement":
      return { kind: "decision", branches: switchBranches(node) };
    case "for_statement":
    case "for_range_loop":
    case "while_statement":
    case "do_statement":
      return {
        kind: "loop",
        label: firstLine(node.text),
        body: bodyOf(node.childForFieldName("body")),
      };
    case "return_statement":
    case "throw_statement":
      return { kind: "terminator", text: firstLine(node.text) };
    default:
      return { kind: "action", text: firstLine(node.text) };
  }
}

function switchBranches(node: Node): FlowBranch[] {
  const branches: FlowBranch[] = [];
  const body = node.childForFieldName("body");
  if (!body) return branches;
  for (const child of body.namedChildren) {
    if (child.type !== "case_statement") continue;
    const label = child.childForFieldName("value")?.text ?? "case";
    const flow = toFlow(child);
    branches.push({ label, body: flow ? [flow] : [] });
  }
  return branches;
}

function bodyOf(node: Node | null | undefined): FlowNode[] {
  if (!node) return [];
  if (node.type === "compound_statement") return buildFlow(node);
  if (node.type === "else_clause") {
    const out: FlowNode[] = [];
    for (const child of node.namedChildren) {
      const flow = toFlow(child);
      if (flow) out.push(flow);
    }
    return out;
  }
  const flow = toFlow(node);
  return flow ? [flow] : [];
}

/* ------------------------------------------------------------------ */
/* Imports / calls / declarations                                      */
/* ------------------------------------------------------------------ */

function collectImports(root: Node): ImportReport[] {
  const imports: ImportReport[] = [];
  walk(root, (node) => {
    if (node.type !== "preproc_include") return;
    const raw = node.childForFieldName("path")?.text ?? "";
    const module = raw.replace(/^[<"]|[">]$/g, "");
    if (module) imports.push({ module, names: [], typeOnly: false });
  });
  return imports;
}

function collectCalls(body: Node): string[] {
  const names = new Set<string>();
  walk(body, (node) => {
    if (node.type !== "call_expression") return;
    const fn = node.childForFieldName("function");
    if (fn) names.add(fn.text);
  });
  return [...names];
}

function collectDeclarations(root: Node, path: string): DeclarationReport[] {
  const out: DeclarationReport[] = [];
  walk(root, (node) => {
    if (
      node.type !== "struct_specifier" &&
      node.type !== "class_specifier" &&
      node.type !== "union_specifier" &&
      node.type !== "enum_specifier"
    ) {
      return;
    }
    const name = node.childForFieldName("name")?.text;
    if (!name) return;
    const line = node.startPosition.row + 1;
    out.push({
      id: `${path}:${line}:${name}`,
      name,
      kind: node.type === "enum_specifier" ? "enum" : "class",
      path,
      line,
      abstract: false,
      extends: [],
      implements: [],
      members: membersOf(node),
    });
  });
  return out;
}

function membersOf(node: Node): MemberReport[] {
  const members: MemberReport[] = [];
  const add = (name: string, kind: MemberReport["kind"], type?: string): void => {
    members.push({
      name,
      kind,
      visibility: "public",
      static: false,
      abstract: false,
      readonly: false,
      optional: false,
      ...(type ? { type } : {}),
    });
  };

  walk(node, (child) => {
    if (child.type === "field_declaration") {
      const type = child.childForFieldName("type")?.text;
      for (const declarator of child.childrenForFieldName("declarator")) {
        const name = simpleName(declarator);
        if (name) add(name, "property", type);
      }
    } else if (child !== node && child.type === "function_definition") {
      add(declaratorName(child).name, "method");
      return false;
    }
  });
  return members;
}

function countMarkers(comments: readonly string[]): Markers {
  const markers: Markers = { todo: 0, fixme: 0, hack: 0 };
  for (const comment of comments) {
    for (const match of comment.matchAll(MARKER_PATTERN)) {
      const kind = match[1]?.toLowerCase();
      if (kind === "todo") markers.todo++;
      else if (kind === "fixme") markers.fixme++;
      else if (kind === "hack") markers.hack++;
    }
  }
  return markers;
}

/* ------------------------------------------------------------------ */
/* Analyzer                                                            */
/* ------------------------------------------------------------------ */

export class TreeSitterAnalyzer implements LanguageAnalyzer {
  constructor(
    readonly id: LanguageId,
    private readonly grammar: TreeSitterGrammar,
    readonly extensions: readonly string[],
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

    const loc = measureLoc(ctx.source, root);
    const functions = this.collectFunctions(root, ctx.path, loc.code);
    const declarations = collectDeclarations(root, ctx.path);
    const imports = collectImports(root);

    const comments: string[] = [];
    walk(root, (node) => {
      if (node.type === "comment") comments.push(node.text);
    });
    const markers = countMarkers(comments);

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
      markers,
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

    // Track the enclosing class/struct/union so member functions become methods
    // even when declared inline without a `Class::` qualifier.
    const visit = (node: Node, enclosing: string | undefined): void => {
      let owner = enclosing;
      if (
        node.type === "class_specifier" ||
        node.type === "struct_specifier" ||
        node.type === "union_specifier"
      ) {
        owner = node.childForFieldName("name")?.text ?? enclosing;
      }

      if (node.type === "function_definition" && node.childForFieldName("body")) {
        out.push(this.functionReport(node, path, code, owner));
        return; // do not descend into the body for further class ownership
      }

      for (const child of node.children) visit(child, owner);
    };

    visit(root, undefined);
    return out;
  }

  private functionReport(
    node: Node,
    path: string,
    code: ReadonlySet<number>,
    enclosing: string | undefined,
  ): FunctionReport {
    const body = node.childForFieldName("body") as Node;
    const range = rangeOf(node);
    const declared = declaratorName(node);
    const owner = declared.owner ?? enclosing;
    const halstead = halsteadOf(body);
    const complexity = cyclomatic(body);
    const lines = codeLinesIn(code, range);
    const kind: FunctionKind = owner ? "method" : "function";

    return {
      id: `${path}:${range.start.line}:${declared.name}`,
      name: declared.name,
      ...(owner ? { owner } : {}),
      kind,
      range,
      loc: lines,
      params: parameterCount(node),
      cyclomatic: complexity,
      cognitive: cognitiveComplexity(body),
      maxNesting: maxNesting(body),
      halstead,
      maintainability: maintainabilityIndex(halstead.volume, complexity, lines),
      calls: collectCalls(body),
      flow: buildFlow(body),
    };
  }
}
