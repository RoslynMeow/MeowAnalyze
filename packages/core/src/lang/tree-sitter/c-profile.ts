/**
 * C / C++ language profile for the generic tree-sitter analyzer: the node-type
 * vocabulary plus a few accessors. See `analyzer.ts` for the engine.
 */
import type { DeclarationReport, FlowBranch, FlowNode } from "../../report/model.js";
import type { AnalyzerProfile, FunctionShape, Node } from "./analyzer.js";

const FUNCTION_TYPES = new Set(["function_definition"]);

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

const DECLARATION_TYPES = new Set([
  "struct_specifier",
  "class_specifier",
  "union_specifier",
  "enum_specifier",
]);

const CONTAINER_TYPES = new Set([
  "class_specifier",
  "struct_specifier",
  "union_specifier",
]);

const LOGICAL_OPERATORS = new Set(["&&", "||"]);

function firstLine(text: string, max = 60): string {
  const line = text.split("\n", 1)[0]?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

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
  const unwrapped =
    node.childForFieldName("declarator") !== null
      ? unwrapDeclarator(node.childForFieldName("declarator"))
      : unwrapDeclarator(node);
  const target =
    unwrapped?.type === "function_declarator"
      ? unwrapped.childForFieldName("declarator")
      : unwrapped;
  const text = target?.text ?? "<anonymous>";
  const separator = text.lastIndexOf("::");
  if (separator === -1) return { name: text };
  return { name: text.slice(separator + 2), owner: text.slice(0, separator) };
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

/** First identifier-ish name in a declarator subtree (fields, variables). */
function simpleName(node: Node): string {
  let name = "";
  const visit = (child: Node): boolean | void => {
    if (name) return false;
    if (
      child.type === "identifier" ||
      child.type === "field_identifier" ||
      child.type === "type_identifier"
    ) {
      name = child.text;
      return false;
    }
    for (const grandchild of child.children) visit(grandchild);
  };
  visit(node);
  return name;
}

function membersOf(node: Node): DeclarationReport["members"] {
  const members: DeclarationReport["members"] = [];
  const add = (name: string, kind: "property" | "method", type?: string): void => {
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

  const visit = (child: Node): void => {
    if (child.type === "field_declaration") {
      const type = child.childForFieldName("type")?.text;
      for (const declarator of child.childrenForFieldName("declarator")) {
        const name = simpleName(declarator);
        if (name) add(name, "property", type);
      }
    } else if (child.type === "function_definition") {
      add(declaratorName(child).name, "method");
      return;
    }
    for (const grandchild of child.children) visit(grandchild);
  };
  for (const child of node.children) visit(child);
  return members;
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
  if (node.type === "compound_statement") {
    const out: FlowNode[] = [];
    for (const statement of node.namedChildren) {
      const flow = toFlow(statement);
      if (flow) out.push(flow);
    }
    return out;
  }
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

export const C_CPP_PROFILE: AnalyzerProfile = {
  functionTypes: FUNCTION_TYPES,
  functionShape(node, enclosing): FunctionShape | undefined {
    const body = node.childForFieldName("body");
    if (!body) return undefined;
    const declared = declaratorName(node);
    const owner = declared.owner ?? enclosing;
    return {
      node,
      body,
      name: declared.name,
      ...(owner ? { owner } : {}),
      params: parameterCount(node),
      kind: owner ? "method" : "function",
    };
  },

  decisionTypes: DECISION_TYPES,
  logicalDecision(node) {
    if (node.type !== "binary_expression") return false;
    const operator = node.childForFieldName("operator")?.text;
    return operator !== undefined && LOGICAL_OPERATORS.has(operator);
  },
  nestingTypes: NESTING_TYPES,
  statementTypes: STATEMENT_TYPES,
  cognitive: {
    ifTypes: new Set(["if_statement"]),
    elifTypes: new Set(),
    loopTypes: LOOP_TYPES,
    switchTypes: new Set(["switch_statement"]),
    catchTypes: new Set(["catch_clause"]),
    ternaryTypes: new Set(["conditional_expression"]),
    ifCondition: (node) => node.childForFieldName("condition"),
    ifConsequence: (node) => node.childForFieldName("consequence"),
    ifAlternative: (node) => node.childForFieldName("alternative"),
    isElseIf: (node) => node.parent?.type === "else_clause",
    isPlainElse: (node) => {
      const alternative = node.childForFieldName("alternative");
      return (
        alternative?.type === "else_clause" &&
        !alternative.namedChildren.some((child) => child.type === "if_statement")
      );
    },
    logicalOperator: (node) =>
      node.type === "binary_expression"
        ? node.childForFieldName("operator")?.text
        : undefined,
  },

  operatorTypes: OPERATOR_TYPES,
  operandTypes: OPERAND_TYPES,

  commentTypes: new Set(["comment"]),

  importTypes: new Set(["preproc_include"]),
  importModule(node) {
    const raw = node.childForFieldName("path")?.text ?? "";
    const module = raw.replace(/^[<"]|[">]$/g, "");
    return module || undefined;
  },

  callTypes: new Set(["call_expression"]),
  calleeName: (node) => node.childForFieldName("function")?.text,

  declarationTypes: DECLARATION_TYPES,
  declaration(node, path) {
    const name = node.childForFieldName("name")?.text;
    if (!name) return undefined;
    const line = node.startPosition.row + 1;
    return {
      id: `${path}:${line}:${name}`,
      name,
      kind: node.type === "enum_specifier" ? "enum" : "class",
      path,
      line,
      abstract: false,
      extends: [],
      implements: [],
      members: membersOf(node),
    };
  },

  containerTypes: CONTAINER_TYPES,
  containerName: (node) => node.childForFieldName("name")?.text,

  flowNode: toFlow,
};
