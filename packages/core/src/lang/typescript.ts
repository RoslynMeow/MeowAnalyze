import ts from "typescript";
import type {
  FileReport,
  FunctionKind,
  FunctionReport,
  LanguageId,
  LocStats,
  Position,
  Range,
} from "../report/model.js";
import { distributionOf } from "../metrics/distribution.js";
import type { FileContext, LanguageAnalyzer } from "./analyzer.js";

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
    const functions = collectFunctions(sf, ctx.path);

    const metrics = {
      cyclomatic: distributionOf(functions.map((f) => f.cyclomatic)),
      nesting: distributionOf(functions.map((f) => f.maxNesting)),
      functionLoc: distributionOf(functions.map((f) => f.loc)),
      params: distributionOf(functions.map((f) => f.params)),
    };

    return {
      path: ctx.path,
      language,
      loc,
      metrics,
      functions,
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

function measureLoc(
  source: string,
  sf: ts.SourceFile,
  jsx: boolean,
): LocStats {
  const physical = sf.getLineStarts().length;
  const variant = jsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ false,
    variant,
    source,
  );

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

function collectFunctions(sf: ts.SourceFile, path: string): FunctionReport[] {
  const out: FunctionReport[] = [];
  const visit = (node: ts.Node): void => {
    if (isFunctionLike(node) && hasBody(node)) {
      out.push(analyzeFunction(node, sf, path));
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return out;
}

function analyzeFunction(
  node: ts.FunctionLikeDeclaration,
  sf: ts.SourceFile,
  path: string,
): FunctionReport {
  const name = functionName(node);
  const range = rangeOf(node, sf);
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

  return {
    id: `${path}:${range.start.line}:${name}`,
    name,
    kind: functionKind(node),
    range,
    loc: range.end.line - range.start.line + 1,
    params: node.parameters.length,
    cyclomatic,
    maxNesting,
  };
}

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
