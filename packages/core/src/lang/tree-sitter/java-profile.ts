/**
 * Java language profile for the generic tree-sitter analyzer.
 */
import type { DeclarationReport, FlowBranch, FlowNode } from "../../report/model.js";
import type { AnalyzerProfile, FunctionShape, Node } from "./analyzer.js";

const FUNCTION_TYPES = new Set(["method_declaration", "constructor_declaration"]);

const CONTAINER_TYPES = new Set([
  "class_declaration",
  "interface_declaration",
  "enum_declaration",
  "record_declaration",
  "annotation_type_declaration",
]);

const LOOP_TYPES = new Set([
  "for_statement",
  "enhanced_for_statement",
  "while_statement",
  "do_statement",
]);

const SWITCH_TYPES = new Set(["switch_expression", "switch_statement"]);

const NESTING_TYPES = new Set([
  "if_statement",
  ...LOOP_TYPES,
  ...SWITCH_TYPES,
  "try_statement",
  "catch_clause",
  "synchronized_statement",
]);

const TERNARY_TYPES = new Set(["ternary_expression", "conditional_expression"]);

const DECISION_TYPES = new Set([
  "if_statement",
  ...LOOP_TYPES,
  "catch_clause",
  "switch_label",
  ...TERNARY_TYPES,
]);

const STATEMENT_TYPES = new Set([
  "expression_statement",
  "local_variable_declaration",
  "return_statement",
  "throw_statement",
  "break_statement",
  "continue_statement",
  "yield_statement",
  "assert_statement",
  "if_statement",
  ...LOOP_TYPES,
  ...SWITCH_TYPES,
  "try_statement",
  "synchronized_statement",
]);

const OPERATOR_TYPES = new Set([
  "binary_expression",
  "unary_expression",
  "update_expression",
  "assignment_expression",
  "ternary_expression",
  "method_invocation",
  "object_creation_expression",
  "array_access",
  "field_access",
  "cast_expression",
  "instanceof_expression",
]);

const OPERAND_TYPES = new Set([
  "identifier",
  "type_identifier",
  "decimal_integer_literal",
  "hex_integer_literal",
  "octal_integer_literal",
  "binary_integer_literal",
  "decimal_floating_point_literal",
  "hex_floating_point_literal",
  "string_literal",
  "character_literal",
  "true",
  "false",
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
    if (field && (field.type === "identifier" || field.type === "type_identifier")) {
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

function memberKind(type: string): "property" | "method" | "constructor" {
  if (type === "method_declaration") return "method";
  if (type === "constructor_declaration") return "constructor";
  return "property";
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
      for (const declarator of child.childrenForFieldName("declarator")) {
        add(simpleName(declarator), "property");
      }
    } else if (
      child.type === "method_declaration" ||
      child.type === "constructor_declaration"
    ) {
      add(child.childForFieldName("name")?.text ?? "", memberKind(child.type));
    }
  }
  return members;
}

function blockFlow(node: Node | null | undefined): FlowNode[] {
  if (!node) return [];
  if (node.type === "block" || node.type === "constructor_body") {
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
    if (child.type !== "switch_block_statement_group") continue;
    const label = child.namedChildren.find((n) => n.type === "switch_label");
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
    case "switch_expression":
    case "switch_statement":
      return { kind: "decision", branches: switchBranches(node) };
    case "for_statement":
    case "enhanced_for_statement":
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

export const JAVA_PROFILE: AnalyzerProfile = {
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

  commentTypes: new Set(["line_comment", "block_comment", "comment"]),

  importTypes: new Set(["import_declaration"]),
  importModule(node) {
    const named = node.namedChildren.find((child) =>
      child.type === "scoped_identifier" || child.type === "identifier",
    );
    return named?.text;
  },

  callTypes: new Set(["method_invocation"]),
  calleeName: (node) => node.childForFieldName("name")?.text,

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
