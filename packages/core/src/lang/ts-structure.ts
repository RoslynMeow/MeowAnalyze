import ts from "typescript";
import type {
  DeclarationKind,
  DeclarationReport,
  FlowBranch,
  FlowNode,
  ImportReport,
  MemberKind,
  MemberReport,
  Visibility,
} from "../report/model.js";

/* ------------------------------------------------------------------ */
/* Declarations (classes, interfaces, enums)                           */
/* ------------------------------------------------------------------ */

export function collectDeclarations(
  sf: ts.SourceFile,
  path: string,
): DeclarationReport[] {
  const out: DeclarationReport[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      out.push(declarationOf(node, sf, path));
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return out;
}

function declarationOf(
  node: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration,
  sf: ts.SourceFile,
  path: string,
): DeclarationReport {
  const name = node.name?.text ?? "(anonymous)";
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const kind: DeclarationKind = ts.isClassDeclaration(node)
    ? "class"
    : ts.isInterfaceDeclaration(node)
      ? "interface"
      : "enum";

  const extendsList: string[] = [];
  const implementsList: string[] = [];
  if (!ts.isEnumDeclaration(node)) {
    for (const clause of node.heritageClauses ?? []) {
      const target =
        clause.token === ts.SyntaxKind.ExtendsKeyword ? extendsList : implementsList;
      for (const type of clause.types) target.push(typeName(type.getText(sf)));
    }
  }

  return {
    id: `${path}:${line}:${name}`,
    name,
    kind,
    path,
    line,
    abstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword),
    extends: extendsList,
    implements: implementsList,
    members: membersOf(node, sf),
  };
}

function membersOf(
  node: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration,
  sf: ts.SourceFile,
): MemberReport[] {
  const out: MemberReport[] = [];
  for (const member of node.members) {
    if (ts.isEnumMember(member)) {
      out.push(memberReport(memberName(member.name, sf), "enum-member", member));
      continue;
    }
    if (ts.isConstructorDeclaration(member)) {
      out.push({
        ...memberReport("constructor", "constructor", member),
        params: member.parameters.length,
      });
      continue;
    }
    if (ts.isGetAccessorDeclaration(member)) {
      out.push({
        ...memberReport(memberName(member.name, sf), "getter", member),
        type: member.type?.getText(sf),
        params: member.parameters.length,
      });
      continue;
    }
    if (ts.isSetAccessorDeclaration(member)) {
      out.push({
        ...memberReport(memberName(member.name, sf), "setter", member),
        params: member.parameters.length,
      });
      continue;
    }
    if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      out.push({
        ...memberReport(memberName(member.name, sf), "method", member),
        type: member.type?.getText(sf),
        params: member.parameters.length,
      });
      continue;
    }
    if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
      out.push({
        ...memberReport(memberName(member.name, sf), "property", member),
        type: member.type?.getText(sf),
      });
    }
  }
  return out;
}

function memberReport(
  name: string,
  kind: MemberKind,
  node: ts.Node,
): MemberReport {
  return {
    name,
    kind,
    visibility: visibilityOf(node),
    static: hasModifier(node, ts.SyntaxKind.StaticKeyword),
    abstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword),
    readonly: hasModifier(node, ts.SyntaxKind.ReadonlyKeyword),
    optional: ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)
      ? Boolean(node.questionToken)
      : Boolean((node as { questionToken?: ts.Node }).questionToken),
  };
}

function memberName(name: ts.PropertyName | undefined, sf: ts.SourceFile): string {
  if (!name) return "(anonymous)";
  if (ts.isPrivateIdentifier(name)) return `#${name.text}`;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return `[${name.getText(sf)}]`;
}

function visibilityOf(node: ts.Node): Visibility {
  for (const modifier of modifiersOf(node)) {
    if (modifier.kind === ts.SyntaxKind.PrivateKeyword) return "private";
    if (modifier.kind === ts.SyntaxKind.ProtectedKeyword) return "protected";
  }
  const name = (node as { name?: ts.Node }).name;
  if (name && ts.isPrivateIdentifier(name)) return "private";
  return "public";
}

function modifiersOf(node: ts.Node): readonly ts.Modifier[] {
  return ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return modifiersOf(node).some((modifier) => modifier.kind === kind);
}

/* ------------------------------------------------------------------ */
/* Imports / re-exports                                                */
/* ------------------------------------------------------------------ */

export function collectImports(sf: ts.SourceFile): ImportReport[] {
  const out: ImportReport[] = [];
  for (const statement of sf.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      out.push({
        module: statement.moduleSpecifier.text,
        names: importNames(statement.importClause),
        typeOnly: Boolean(statement.importClause?.isTypeOnly),
      });
      continue;
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const clause = statement.exportClause;
      const names =
        clause && ts.isNamedExports(clause)
          ? clause.elements.map((element) => element.name.text)
          : [];
      out.push({
        module: statement.moduleSpecifier.text,
        names,
        typeOnly: Boolean(statement.isTypeOnly),
      });
      continue;
    }
    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteral(statement.moduleReference.expression)
    ) {
      out.push({
        module: statement.moduleReference.expression.text,
        names: [statement.name.text],
        typeOnly: false,
      });
    }
  }
  return out;
}

function importNames(clause: ts.ImportClause | undefined): string[] {
  if (!clause) return [];
  const names: string[] = [];
  if (clause.name) names.push(clause.name.text);
  const bindings = clause.namedBindings;
  if (bindings) {
    if (ts.isNamespaceImport(bindings)) names.push(bindings.name.text);
    else for (const element of bindings.elements) names.push(element.name.text);
  }
  return names;
}

/* ------------------------------------------------------------------ */
/* Call sites (static approximation)                                   */
/* ------------------------------------------------------------------ */

export function collectCalls(node: ts.Node | undefined, sf: ts.SourceFile): string[] {
  if (!node) return [];
  const found = new Set<string>();
  const visit = (current: ts.Node): void => {
    if (ts.isCallExpression(current) || ts.isNewExpression(current)) {
      found.add(current.expression.getText(sf));
    }
    current.forEachChild((child) => {
      if (isFunctionLike(child)) return;
      visit(child);
    });
  };
  visit(node);
  return [...found];
}

/* ------------------------------------------------------------------ */
/* Control flow (activity diagram)                                     */
/* ------------------------------------------------------------------ */

export function buildFlow(body: ts.Node | undefined, sf: ts.SourceFile): FlowNode[] {
  if (!body) return [];
  if (ts.isBlock(body) || ts.isSourceFile(body) || ts.isModuleBlock(body)) {
    return flowOf([...body.statements], sf);
  }
  if (ts.isStatement(body)) return flowOf([body], sf);
  return [{ kind: "action", text: clip(body.getText(sf)) }];
}

function flowOf(statements: readonly ts.Statement[], sf: ts.SourceFile): FlowNode[] {
  const out: FlowNode[] = [];
  for (const statement of statements) out.push(...flowOfStatement(statement, sf));
  return out;
}

function flowOfStatement(statement: ts.Statement, sf: ts.SourceFile): FlowNode[] {
  if (ts.isBlock(statement)) return flowOf([...statement.statements], sf);

  if (ts.isIfStatement(statement)) {
    const branches: FlowBranch[] = [
      { label: clip(statement.expression.getText(sf), 40), body: buildFlow(statement.thenStatement, sf) },
    ];
    if (statement.elseStatement) {
      branches.push({
        label: "else",
        body: ts.isIfStatement(statement.elseStatement)
          ? flowOfStatement(statement.elseStatement, sf)
          : buildFlow(statement.elseStatement, sf),
      });
    }
    return [{ kind: "decision", branches }];
  }

  if (
    ts.isForStatement(statement) ||
    ts.isForInStatement(statement) ||
    ts.isForOfStatement(statement) ||
    ts.isWhileStatement(statement) ||
    ts.isDoStatement(statement)
  ) {
    return [{ kind: "loop", label: loopLabel(statement), body: buildFlow(statement.statement, sf) }];
  }

  if (ts.isSwitchStatement(statement)) {
    const branches: FlowBranch[] = statement.caseBlock.clauses.map((clause) => ({
      label: ts.isDefaultClause(clause) ? "default" : clip(clause.expression.getText(sf), 30),
      body: flowOf([...clause.statements], sf),
    }));
    return [{ kind: "decision", branches }];
  }

  if (ts.isReturnStatement(statement)) {
    return [{ kind: "terminator", text: statement.expression ? clip(statement.expression.getText(sf)) : "return" }];
  }
  if (ts.isThrowStatement(statement)) return [{ kind: "terminator", text: "throw" }];
  if (ts.isBreakStatement(statement)) return [{ kind: "terminator", text: "break" }];
  if (ts.isContinueStatement(statement)) return [{ kind: "terminator", text: "continue" }];

  if (ts.isTryStatement(statement)) {
    const out: FlowNode[] = [{ kind: "action", text: "try" }, ...buildFlow(statement.tryBlock, sf)];
    if (statement.catchClause) {
      out.push(
        { kind: "action", text: `catch${statement.catchClause.variableDeclaration ? ` (${statement.catchClause.variableDeclaration.name.getText(sf)})` : ""}` },
        ...buildFlow(statement.catchClause.block, sf),
      );
    }
    if (statement.finallyBlock) {
      out.push({ kind: "action", text: "finally" }, ...buildFlow(statement.finallyBlock, sf));
    }
    return out;
  }

  return [{ kind: "action", text: clip(statement.getText(sf)) }];
}

function loopLabel(statement: ts.Node): string {
  if (ts.isForStatement(statement)) return "for";
  if (ts.isForInStatement(statement)) return "for…in";
  if (ts.isForOfStatement(statement)) return "for…of";
  if (ts.isWhileStatement(statement)) return "while";
  if (ts.isDoStatement(statement)) return "do…while";
  return "loop";
}

function clip(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function typeName(text: string): string {
  return text.replace(/<.*$/, "").trim();
}

function isFunctionLike(node: ts.Node): boolean {
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
