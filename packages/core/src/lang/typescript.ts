import ts from "typescript";
import type {
  FileReport,
  FunctionKind,
  FunctionReport,
  Halstead,
  LanguageId,
  LocStats,
  Markers,
  Position,
  Range,
} from "../report/model.js";
import { distributionOf } from "../metrics/distribution.js";
import type { FileContext, LanguageAnalyzer } from "./analyzer.js";
import {
  buildFlow,
  collectCalls,
  collectDeclarations,
  collectImports,
} from "./ts-structure.js";

const EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

const SCRIPT_KINDS: Record<string, ts.ScriptKind> = {
  ".ts": ts.ScriptKind.TS,
  ".mts": ts.ScriptKind.TS,
  ".cts": ts.ScriptKind.TS,
  ".tsx": ts.ScriptKind.TSX,
  ".js": ts.ScriptKind.JS,
  ".mjs": ts.ScriptKind.JS,
  ".cjs": ts.ScriptKind.JS,
  ".jsx": ts.ScriptKind.JSX,
};

/**
 * Front-end for JavaScript / TypeScript built on the compiler's own parser.
 * Pure JS, no native build, and the AST carries exact source positions.
 */
export class TypeScriptAnalyzer implements LanguageAnalyzer {
  readonly id: LanguageId = "typescript";

  readonly extensions: readonly string[] = EXTENSIONS;

  matches(path: string, _head: string): boolean {
    return extensionOf(path) !== undefined;
  }

  analyze(ctx: FileContext): FileReport {
    const extension = extensionOf(ctx.path) ?? ".ts";
    const scriptKind = SCRIPT_KINDS[extension] ?? ts.ScriptKind.TS;
    const language: LanguageId =
      scriptKind === ts.ScriptKind.TS || scriptKind === ts.ScriptKind.TSX
        ? "typescript"
        : "javascript";

    const sf = ts.createSourceFile(
      ctx.path,
      ctx.source,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      scriptKind,
    );

    const loc = measureLoc(ctx.source, sf, isJsx(scriptKind));
    const markers = countMarkers(ctx.source, isJsx(scriptKind));
    const functions = collectFunctions(sf, ctx.source, ctx.path);

    const metrics = {
      cyclomatic: distributionOf(functions.map((f) => f.cyclomatic)),
      cognitive: distributionOf(functions.map((f) => f.cognitive)),
      nesting: distributionOf(functions.map((f) => f.maxNesting)),
      functionLoc: distributionOf(functions.map((f) => f.loc)),
      params: distributionOf(functions.map((f) => f.params)),
      maintainability: distributionOf(functions.map((f) => f.maintainability)),
      halsteadVolume: distributionOf(functions.map((f) => f.halstead.volume)),
      halsteadDifficulty: distributionOf(functions.map((f) => f.halstead.difficulty)),
      halsteadEffort: distributionOf(functions.map((f) => f.halstead.effort)),
    };

    const totalVolume = functions.reduce((sum, f) => sum + f.halstead.volume, 0);
    const totalCyclomatic = functions.reduce((sum, f) => sum + f.cyclomatic, 0);
    const maintainability = maintainabilityIndex(
      totalVolume,
      totalCyclomatic,
      loc.physical,
    );

    return {
      path: ctx.path,
      language,
      loc,
      maintainability,
      metrics,
      markers,
      functions,
      declarations: collectDeclarations(sf, ctx.path),
      imports: collectImports(sf),
      violations: [],
    };
  }
}

function extensionOf(path: string): string | undefined {
  const match = /\.[^./\\]+$/.exec(path.toLowerCase());
  if (!match) return undefined;
  return EXTENSIONS.includes(match[0]) ? match[0] : undefined;
}

function isJsx(kind: ts.ScriptKind): boolean {
  return kind === ts.ScriptKind.TSX || kind === ts.ScriptKind.JSX;
}

/* ------------------------------------------------------------------ */
/* Lines of code                                                       */
/* ------------------------------------------------------------------ */

function measureLoc(source: string, sf: ts.SourceFile, jsx: boolean): LocStats {
  const physical = sf.getLineStarts().length;
  const scanner = createScanner(source, jsx);

  const codeLines = new Set<number>();
  const commentLines = new Set<number>();

  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    const start = scanner.getTokenPos();
    const end = scanner.getTextPos();
    if (isComment(token)) {
      markLines(commentLines, start, end, sf);
    } else if (!isTrivia(token)) {
      markLines(codeLines, start, end, sf);
    }
    token = scanner.scan();
  }

  let comment = 0;
  for (const line of commentLines) {
    if (!codeLines.has(line)) comment++;
  }

  return {
    physical,
    code: codeLines.size,
    comment,
    blank: physical - codeLines.size - comment,
    logical: countStatements(sf),
  };
}

function createScanner(source: string, jsx: boolean): ts.Scanner {
  return ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ false,
    jsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard,
    source,
  );
}

function isComment(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.SingleLineCommentTrivia ||
    kind === ts.SyntaxKind.MultiLineCommentTrivia ||
    kind === ts.SyntaxKind.ShebangTrivia
  );
}

function isTrivia(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.WhitespaceTrivia ||
    kind === ts.SyntaxKind.NewLineTrivia
  );
}

function markLines(
  target: Set<number>,
  start: number,
  end: number,
  sf: ts.SourceFile,
): void {
  const first = sf.getLineAndCharacterOfPosition(start).line;
  const last = sf.getLineAndCharacterOfPosition(Math.max(start, end - 1)).line;
  for (let line = first; line <= last; line++) target.add(line);
}

/* ------------------------------------------------------------------ */
/* Markers (TODO / FIXME / HACK)                                       */
/* ------------------------------------------------------------------ */

const MARKER_PATTERN = /\b(TODO|FIXME|HACK)\b/gi;

function countMarkers(source: string, jsx: boolean): Markers {
  const markers: Markers = { todo: 0, fixme: 0, hack: 0 };
  const scanner = createScanner(source, jsx);
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (isComment(token)) {
      const matches = scanner.getTokenText().match(MARKER_PATTERN);
      if (matches) {
        for (const match of matches) {
          const key = match.toLowerCase();
          if (key === "todo") markers.todo++;
          else if (key === "fixme") markers.fixme++;
          else if (key === "hack") markers.hack++;
        }
      }
    }
    token = scanner.scan();
  }
  return markers;
}

/* ------------------------------------------------------------------ */
/* Statements (logical LOC)                                            */
/* ------------------------------------------------------------------ */

const STATEMENT_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.ExpressionStatement,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.ReturnStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.BreakStatement,
  ts.SyntaxKind.ContinueStatement,
  ts.SyntaxKind.ThrowStatement,
  ts.SyntaxKind.TryStatement,
  ts.SyntaxKind.WithStatement,
  ts.SyntaxKind.DebuggerStatement,
  ts.SyntaxKind.LabeledStatement,
  ts.SyntaxKind.EmptyStatement,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ImportEqualsDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ExportAssignment,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.ModuleDeclaration,
]);

function countStatements(sf: ts.SourceFile): number {
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (STATEMENT_KINDS.has(node.kind)) count++;
    node.forEachChild(visit);
  };
  visit(sf);
  return count;
}

/* ------------------------------------------------------------------ */
/* Functions & complexity                                              */
/* ------------------------------------------------------------------ */

function collectFunctions(
  sf: ts.SourceFile,
  source: string,
  path: string,
): FunctionReport[] {
  const out: FunctionReport[] = [];
  const visit = (node: ts.Node, owner: string | undefined): void => {
    let nextOwner = owner;
    if (
      (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
      node.name
    ) {
      nextOwner = node.name.text;
    }
    if (isFunctionLike(node) && hasBody(node)) {
      out.push(analyzeFunction(node, sf, source, path, nextOwner));
    }
    node.forEachChild((child) => visit(child, nextOwner));
  };
  visit(sf, undefined);
  return out;
}

function analyzeFunction(
  node: ts.FunctionLikeDeclaration,
  sf: ts.SourceFile,
  source: string,
  path: string,
  owner: string | undefined,
): FunctionReport {
  const name = functionName(node);
  const range = rangeOf(node, sf);
  const loc = range.end.line - range.start.line + 1;

  let cyclomatic = 1;
  let maxNesting = 0;

  const walk = (current: ts.Node, depth: number): void => {
    const nextDepth = isNestingNode(current) ? depth + 1 : depth;
    if (nextDepth > maxNesting) maxNesting = nextDepth;
    if (isDecisionNode(current)) cyclomatic++;
    current.forEachChild((child) => {
      if (isFunctionLike(child)) return; // do not descend into nested functions
      walk(child, nextDepth);
    });
  };

  const body = (node as { body?: ts.Node }).body;
  if (body) walk(body, 0);

  const cognitive = cognitiveComplexity(body);
  const halstead = halsteadOf(node, sf, source);

  return {
    id: `${path}:${range.start.line}:${name}`,
    name,
    owner,
    kind: functionKind(node),
    range,
    loc,
    params: node.parameters.length,
    cyclomatic,
    cognitive,
    maxNesting,
    halstead,
    maintainability: maintainabilityIndex(halstead.volume, cyclomatic, loc),
    calls: collectCalls(body, sf),
    flow: buildFlow(body, sf),
  };
}

/* ------------------------------------------------------------------ */
/* Cognitive complexity (Sonar-style)                                  */
/* ------------------------------------------------------------------ */

const LOOP_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
]);

function cognitiveComplexity(body: ts.Node | undefined): number {
  if (!body) return 0;
  let score = 0;

  const visit = (node: ts.Node, nesting: number): void => {
    const kind = node.kind;

    if (kind === ts.SyntaxKind.IfStatement) {
      const ifNode = node as ts.IfStatement;
      const isElseIf =
        ts.isIfStatement(node.parent) && node.parent.elseStatement === ifNode;
      score += isElseIf ? 1 : 1 + nesting;
      const inner = isElseIf ? nesting : nesting + 1;
      visit(ifNode.expression, nesting);
      visit(ifNode.thenStatement, inner);
      if (ifNode.elseStatement) {
        if (ts.isIfStatement(ifNode.elseStatement)) {
          visit(ifNode.elseStatement, inner);
        } else {
          score += 1;
          visit(ifNode.elseStatement, inner);
        }
      }
      return;
    }

    if (LOOP_KINDS.has(kind) || kind === ts.SyntaxKind.SwitchStatement) {
      score += 1 + nesting;
      node.forEachChild((child) => {
        if (!isFunctionLike(child)) visit(child, nesting + 1);
      });
      return;
    }

    if (kind === ts.SyntaxKind.CatchClause) {
      score += 1 + nesting;
      node.forEachChild((child) => {
        if (!isFunctionLike(child)) visit(child, nesting + 1);
      });
      return;
    }

    if (kind === ts.SyntaxKind.ConditionalExpression) {
      score += 1 + nesting;
      node.forEachChild((child) => {
        if (!isFunctionLike(child)) visit(child, nesting + 1);
      });
      return;
    }

    if (
      ts.isBinaryExpression(node) &&
      LOGICAL_OPERATORS.has(node.operatorToken.kind)
    ) {
      const sameAsParent =
        ts.isBinaryExpression(node.parent) &&
        node.parent.operatorToken.kind === node.operatorToken.kind;
      if (!sameAsParent) score += 1; // one point per sequence of like operators
      node.forEachChild((child) => visit(child, nesting));
      return;
    }

    if (isFunctionLike(node)) return; // nested functions are measured separately
    node.forEachChild((child) => visit(child, nesting));
  };

  visit(body, 0);
  return score;
}

/* ------------------------------------------------------------------ */
/* Halstead                                                            */
/* ------------------------------------------------------------------ */

const OPERAND_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.Identifier,
  ts.SyntaxKind.PrivateIdentifier,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword,
]);

function halsteadOf(
  node: ts.FunctionLikeDeclaration,
  sf: ts.SourceFile,
  source: string,
): Halstead {
  const text = source.slice(node.getStart(sf), node.getEnd());
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ false,
    ts.LanguageVariant.Standard,
    text,
  );

  const operators = new Map<string, number>();
  const operands = new Map<string, number>();

  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (!isTrivia(token) && !isComment(token)) {
      const target = OPERAND_KINDS.has(token) ? operands : operators;
      const value = scanner.getTokenText();
      target.set(value, (target.get(value) ?? 0) + 1);
    }
    token = scanner.scan();
  }

  const distinctOperators = operators.size;
  const distinctOperands = operands.size;
  const totalOperators = sumValues(operators);
  const totalOperands = sumValues(operands);
  const vocabulary = distinctOperators + distinctOperands;
  const length = totalOperators + totalOperands;
  const volume = vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
  const difficulty =
    distinctOperands > 0
      ? (distinctOperators / 2) * (totalOperands / distinctOperands)
      : 0;
  const effort = difficulty * volume;

  return {
    distinctOperators,
    distinctOperands,
    totalOperators,
    totalOperands,
    vocabulary,
    length,
    volume,
    difficulty,
    effort,
  };
}

function sumValues(map: Map<string, number>): number {
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}

/** Normalized maintainability index (0–100, higher is better). */
function maintainabilityIndex(
  volume: number,
  cyclomatic: number,
  loc: number,
): number {
  if (loc <= 0) return 100;
  const raw =
    171 -
    3.42 * Math.log(Math.max(volume, 1)) -
    0.23 * cyclomatic -
    16.2 * Math.log(loc);
  return Math.max(0, Math.min(100, (raw * 100) / 171));
}

/* ------------------------------------------------------------------ */
/* AST helpers                                                         */
/* ------------------------------------------------------------------ */

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function hasBody(node: ts.Node): boolean {
  return (node as { body?: ts.Node }).body !== undefined;
}

function functionKind(node: ts.FunctionLikeDeclaration): FunctionKind {
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (ts.isGetAccessorDeclaration(node)) return "getter";
  if (ts.isSetAccessorDeclaration(node)) return "setter";
  if (ts.isArrowFunction(node)) return "arrow";
  if (ts.isMethodDeclaration(node)) return "method";
  return "function";
}

function functionName(node: ts.FunctionLikeDeclaration): string {
  if (ts.isConstructorDeclaration(node)) return "constructor";

  const name = (node as { name?: ts.Node }).name;
  if (name && ts.isIdentifier(name)) return name.text;
  if (name && ts.isStringLiteralLike(name)) return name.text;

  const parent = node.parent;
  if (parent) {
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) {
      const key = parent.name;
      if (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) return key.text;
    }
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(parent.left)
    ) {
      return parent.left.text;
    }
  }
  return "(anonymous)";
}

const NESTING_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.TryStatement,
]);

function isNestingNode(node: ts.Node): boolean {
  return NESTING_KINDS.has(node.kind);
}

const DECISION_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ConditionalExpression,
]);

const LOGICAL_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

function isDecisionNode(node: ts.Node): boolean {
  if (DECISION_KINDS.has(node.kind)) return true;
  return (
    ts.isBinaryExpression(node) &&
    LOGICAL_OPERATORS.has(node.operatorToken.kind)
  );
}

function positionOf(pos: number, sf: ts.SourceFile): Position {
  const { line, character } = sf.getLineAndCharacterOfPosition(pos);
  return { line: line + 1, column: character + 1 };
}

function rangeOf(node: ts.Node, sf: ts.SourceFile): Range {
  return {
    start: positionOf(node.getStart(sf), sf),
    end: positionOf(node.getEnd(), sf),
  };
}
