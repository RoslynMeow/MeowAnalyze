/**
 * Go language profile for the generic tree-sitter analyzer.
 */
import type { DeclarationReport, FlowBranch, FlowNode } from "../../report/model.js";
import type { AnalyzerProfile, FunctionShape, Node } from "./analyzer.js";

const FUNCTION_TYPES = new Set(["function_declaration", "method_declaration"]);

const LOOP_TYPES = new Set(["for_statement"]);

const SWITCH_TYPES = new Set([
  "expression_switch_statement",
  "type_switch_statement",
  "select_statement",
]);

const CASE_TYPES = new Set(["expression_case", "type_case", "communication_case"]);

const NESTING_TYPES = new Set(["if_statement", ...LOOP_TYPES, ...SWITCH_TYPES]);

const DECISION_TYPES = new Set(["if_statement", ...LOOP_TYPES, ...CASE_TYPES]);

const STATEMENT_TYPES = new Set([
  "expression_statement",
  "assignment_statement",
  "short_var_declaration",
  "var_declaration",
  "const_declaration",
  "return_statement",
  "go_statement",
  "defer_statement",
  "if_statement",
  ...LOOP_TYPES,
  ...SWITCH_TYPES,
  "break_statement",
  "continue_statement",
  "goto_statement",
  "labeled_statement",
  "send_statement",
  "inc_statement",
  "dec_statement",
]);

const OPERATOR_TYPES = new Set([
  "binary_expression",
  "unary_expression",
  "assignment_statement",
  "short_var_declaration",
  "call_expression",
  "index_expression",
  "slice_expression",
  "selector_expression",
  "type_assertion_expression",
  "type_conversion_expression",
  "inc_statement",
  "dec_statement",
  "composite_literal",
]);

const OPERAND_TYPES = new Set([
  "identifier",
  "field_identifier",
  "type_identifier",
  "int_literal",
  "float_literal",
  "imaginary_literal",
  "rune_literal",
  "raw_string_literal",
  "interpreted_string_literal",
  "true",
  "false",
  "nil",
]);

const LOGICAL_OPERATORS = new Set(["&&", "||"]);

function firstLine(text: string, max = 60): string {
  const line = text.split("\n", 1)[0]?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function stripQuotes(text: string): string {
  return text.replace(/^["`]|["`]$/g, "");
}

/** `func (p Point) Sum()` -> "Point". */
function receiverOwner(node: Node): string | undefined {
  const receiver = node.childForFieldName("receiver");
  const parameter = receiver?.namedChildren[0];
  let type = parameter?.childForFieldName("type");
  if (type?.type === "pointer_type") type = type.namedChildren[0];
  return type?.text;
}

function membersOf(typeNode: Node | null): DeclarationReport["members"] {
  const members: DeclarationReport["members"] = [];
  if (!typeNode) return members;

  if (typeNode.type === "struct_type") {
    const list = typeNode.namedChildren.find((child) => child.type === "field_declaration_list");
    for (const field of list?.namedChildren ?? []) {
      if (field.type !== "field_declaration") continue;
      const type = field.childForFieldName("type")?.text;
      for (const name of field.childrenForFieldName("name")) {
        members.push({
          name: name.text,
          kind: "property",
          visibility: "public",
          static: false,
          abstract: false,
          readonly: false,
          optional: false,
          ...(type ? { type } : {}),
        });
      }
    }
  } else if (typeNode.type === "interface_type") {
    for (const element of typeNode.namedChildren) {
      const name = element.childForFieldName("name")?.text;
      if (!name) continue;
      members.push({
        name,
        kind: "method",
        visibility: "public",
        static: false,
        abstract: false,
        readonly: false,
        optional: false,
      });
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
    case "expression_switch_statement":
    case "type_switch_statement":
      return { kind: "decision", branches: [] };
    case "for_statement":
      return {
        kind: "loop",
        label: firstLine(node.text),
        body: blockFlow(node.childForFieldName("body")),
      };
    case "return_statement":
      return { kind: "terminator", text: firstLine(node.text) };
    default:
      return { kind: "action", text: firstLine(node.text) };
  }
}

export const GO_PROFILE: AnalyzerProfile = {
  functionTypes: FUNCTION_TYPES,
  functionShape(node, enclosing): FunctionShape | undefined {
    const body = node.childForFieldName("body");
    const name = node.childForFieldName("name")?.text;
    if (!body || !name) return undefined;
    const owner =
      node.type === "method_declaration" ? receiverOwner(node) : enclosing;
    return {
      node,
      body,
      name,
      ...(owner ? { owner } : {}),
      params: node.childForFieldName("parameters")?.namedChildCount ?? 0,
      kind: node.type === "method_declaration" ? "method" : "function",
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
    catchTypes: new Set(),
    ternaryTypes: new Set(),
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

  commentTypes: new Set(["comment"]),

  importTypes: new Set(["import_spec"]),
  importModule(node) {
    const path = node.childForFieldName("path")?.text;
    return path ? stripQuotes(path) : undefined;
  },

  callTypes: new Set(["call_expression"]),
  calleeName: (node) => node.childForFieldName("function")?.text,

  declarationTypes: new Set(["type_declaration"]),
  declaration(node, path) {
    const spec = node.namedChildren.find((child) => child.type === "type_spec");
    const name = spec?.childForFieldName("name")?.text;
    if (!spec || !name) return undefined;
    const typeNode = spec.childForFieldName("type");
    const line = node.startPosition.row + 1;
    return {
      id: `${path}:${line}:${name}`,
      name,
      kind: typeNode?.type === "interface_type" ? "interface" : "class",
      path,
      line,
      abstract: false,
      extends: [],
      implements: [],
      members: membersOf(typeNode),
    };
  },

  containerTypes: new Set(),
  containerName: () => undefined,

  flowNode: toFlow,
};
