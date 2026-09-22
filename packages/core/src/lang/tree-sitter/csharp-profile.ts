/**
 * C# language profile for the generic tree-sitter analyzer.
 */
import type { DeclarationReport, FlowBranch, FlowNode } from "../../report/model.js";
import type { AnalyzerProfile, FunctionShape, Node } from "./analyzer.js";

const FUNCTION_TYPES = new Set(["method_declaration", "constructor_declaration"]);

const CONTAINER_TYPES = new Set([
  "class_declaration",
  "interface_declaration",
  "struct_declaration",
  "enum_declaration",
  "record_declaration",
  "record_struct_declaration",
]);

const LOOP_TYPES = new Set([
  "for_statement",
  "for_each_statement",
  "while_statement",
  "do_statement",
]);

const SWITCH_TYPES = new Set(["switch_statement"]);

const NESTING_TYPES = new Set([
  "if_statement",
  ...LOOP_TYPES,
  ...SWITCH_TYPES,
  "try_statement",
  "catch_clause",
  "using_statement",
  "lock_statement",
  "fixed_statement",
]);

const TERNARY_TYPES = new Set(["conditional_expression"]);

const DECISION_TYPES = new Set([
  "if_statement",
  ...LOOP_TYPES,
  "catch_clause",
  "switch_section",
  ...TERNARY_TYPES,
]);

const STATEMENT_TYPES = new Set([
  "expression_statement",
  "local_declaration_statement",
  "return_statement",
  "throw_statement",
  "break_statement",
  "continue_statement",
  "yield_statement",
  "if_statement",
  ...LOOP_TYPES,
  ...SWITCH_TYPES,
  "try_statement",
  "using_statement",
  "lock_statement",
  "fixed_statement",
]);

const OPERATOR_TYPES = new Set([
  "binary_expression",
  "prefix_unary_expression",
  "postfix_unary_expression",
  "assignment_expression",
  "conditional_expression",
  "invocation_expression",
  "object_creation_expression",
  "element_access_expression",
  "member_access_expression",
  "cast_expression",
  "is_expression",
  "as_expression",
  "await_expression",
]);

const OPERAND_TYPES = new Set([
  "identifier",
  "integer_literal",
  "real_literal",
  "string_literal",
  "character_literal",
  "boolean_literal",
  "null_literal",
]);

const LOGICAL_OPERATORS = new Set(["&&", "||"]);

function firstLine(text: string, max = 60): string {
  const line = text.split("\n", 1)[0]?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function simpleName(node: Node): string {
  let name = "";
  const visit = (child: Node): boolean | void => {
    if (name) return false;
    const field = child.childForFieldName("name");
    if (field && field.type === "identifier") {
      name = field.text;
      return false;
    }
    if (child.type === "identifier") {
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
  const add = (name: string, kind: "property" | "method" | "constructor"): void => {
    if (!name || members.some((member) => member.name === name)) return;
    members.push({
      name,
      kind,
      visibility: "public",
      static: false,
      abstract: false,
      readonly: false,
      optional: false,
    });
  };

  const body = node.childForFieldName("body");
  if (!body) return members;
  for (const child of body.namedChildren) {
    if (child.type === "field_declaration") {
      const declaration = child.namedChildren.find(
        (n) => n.type === "variable_declaration",
      );
      if (declaration) {
        for (const declarator of declaration.namedChildren) {
          if (declarator.type === "variable_declarator") {
            add(simpleName(declarator), "property");
          }
        }
      }
    } else if (child.type === "property_declaration") {
      add(child.childForFieldName("name")?.text ?? "", "property");
    } else if (child.type === "method_declaration") {
      add(child.childForFieldName("name")?.text ?? "", "method");
    } else if (child.type === "constructor_declaration") {
      add(child.childForFieldName("name")?.text ?? "", "constructor");
    }
  }
  return members;
}

function blockFlow(node: Node | null | undefined): FlowNode[] {
  if (!node) return [];
  if (node.type === "block") {
    const out: FlowNode[] = [];
    for (const statement of node.namedChildren) {
      const flow = toFlow(statement);
      if (flow) out.push(flow);
    }
    return out;
  }
  const flow = toFlow(node);
  return flow ? [flow] : [];
}

function switchBranches(node: Node): FlowBranch[] {
  const branches: FlowBranch[] = [];
  const body = node.childForFieldName("body");
  if (!body) return branches;
  for (const child of body.namedChildren) {
    if (child.type !== "switch_section") continue;
    const label = child.namedChildren.find((n) => n.type.endsWith("switch_label"));
    branches.push({ label: label?.text ?? "case", body: [] });
  }
  return branches;
}

function toFlow(node: Node): FlowNode | undefined {
  switch (node.type) {
    case "if_statement": {
      const branches: FlowBranch[] = [
        { label: "then", body: blockFlow(node.childForFieldName("consequence")) },
      ];
      const alternative = node.childForFieldName("alternative");
      if (alternative) branches.push({ label: "else", body: blockFlow(alternative) });
      return { kind: "decision", branches };
    }
    case "switch_statement":
      return { kind: "decision", branches: switchBranches(node) };
    case "for_statement":
    case "for_each_statement":
    case "while_statement":
    case "do_statement":
      return {
        kind: "loop",
        label: firstLine(node.text),
        body: blockFlow(node.childForFieldName("body")),
      };
    case "return_statement":
    case "throw_statement":
      return { kind: "terminator", text: firstLine(node.text) };
    default:
      return { kind: "action", text: firstLine(node.text) };
  }
}

export const CSHARP_PROFILE: AnalyzerProfile = {
  functionTypes: FUNCTION_TYPES,
  functionShape(node, enclosing): FunctionShape | undefined {
    const body = node.childForFieldName("body");
    const name = node.childForFieldName("name")?.text;
    if (!body || !name) return undefined;
    const kind =
      node.type === "constructor_declaration"
        ? "constructor"
        : enclosing
          ? "method"
          : "function";
    return {
      node,
      body,
      name,
      ...(enclosing ? { owner: enclosing } : {}),
      params: node.childForFieldName("parameters")?.namedChildCount ?? 0,
      kind,
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
    switchTypes: SWITCH_TYPES,
    catchTypes: new Set(["catch_clause"]),
    ternaryTypes: TERNARY_TYPES,
    ifCondition: (node) => node.childForFieldName("condition"),
    ifConsequence: (node) => node.childForFieldName("consequence"),
    ifAlternative: (node) => node.childForFieldName("alternative"),
    isElseIf: (node) => node.parent?.type === "if_statement",
    isPlainElse: (node) => node.childForFieldName("alternative")?.type !== "if_statement",
    logicalOperator: (node) =>
      node.type === "binary_expression"
        ? node.childForFieldName("operator")?.text
        : undefined,
  },

  operatorTypes: OPERATOR_TYPES,
  operandTypes: OPERAND_TYPES,

  commentTypes: new Set(["comment", "line_comment", "block_comment"]),

  importTypes: new Set(["using_directive"]),
  importModule(node) {
    const named = node.namedChildren.find(
      (child) => child.type === "identifier" || child.type === "qualified_name",
    );
    return named?.text;
  },

  callTypes: new Set(["invocation_expression"]),
  calleeName: (node) => node.childForFieldName("function")?.text,

  declarationTypes: CONTAINER_TYPES,
  declaration(node, path) {
    const name = node.childForFieldName("name")?.text;
    if (!name) return undefined;
    const line = node.startPosition.row + 1;
    const kind =
      node.type === "interface_declaration"
        ? "interface"
        : node.type === "enum_declaration"
          ? "enum"
          : "class";
    return {
      id: `${path}:${line}:${name}`,
      name,
      kind,
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
