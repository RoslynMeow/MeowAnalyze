/**
 * Python language profile for the generic tree-sitter analyzer.
 */
import type { DeclarationReport, FlowBranch, FlowNode } from "../../report/model.js";
import type { AnalyzerProfile, FunctionShape, Node } from "./analyzer.js";

const FUNCTION_TYPES = new Set(["function_definition"]);

const NESTING_TYPES = new Set([
  "if_statement",
  "for_statement",
  "while_statement",
  "try_statement",
  "with_statement",
  "match_statement",
]);

const DECISION_TYPES = new Set([
  "if_statement",
  "for_statement",
  "while_statement",
  "except_clause",
  "conditional_expression",
  "case_clause",
]);

const LOOP_TYPES = new Set(["for_statement", "while_statement"]);

const STATEMENT_TYPES = new Set([
  "expression_statement",
  "return_statement",
  "raise_statement",
  "pass_statement",
  "break_statement",
  "continue_statement",
  "assert_statement",
  "if_statement",
  "for_statement",
  "while_statement",
  "try_statement",
  "with_statement",
  "match_statement",
  "case_clause",
  "import_statement",
  "import_from_statement",
  "global_statement",
  "nonlocal_statement",
  "delete_statement",
]);

const OPERATOR_TYPES = new Set([
  "binary_operator",
  "unary_operator",
  "not_operator",
  "boolean_operator",
  "comparison_operator",
  "augmented_assignment",
  "conditional_expression",
  "subscript",
  "attribute",
  "call",
  "await",
  "lambda",
  "list_comprehension",
  "dictionary_comprehension",
  "set_comprehension",
  "generator_expression",
]);

const OPERAND_TYPES = new Set([
  "identifier",
  "integer",
  "float",
  "string",
  "true",
  "false",
  "none",
]);

const DECLARATION_TYPES = new Set(["class_definition"]);
const CONTAINER_TYPES = new Set(["class_definition"]);

const LOGICAL_OPERATORS = new Set(["and", "or"]);

function firstLine(text: string, max = 60): string {
  const line = text.split("\n", 1)[0]?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function parameterCount(node: Node, owner: string | undefined): number {
  const parameters = node.childForFieldName("parameters");
  if (!parameters) return 0;
  const names = parameters.namedChildren;
  // Methods take an implicit `self` / `cls`; do not count it.
  if (owner && names.length > 0) {
    const first = names[0];
    if (first && (first.text === "self" || first.text === "cls")) {
      return Math.max(0, names.length - 1);
    }
  }
  return names.length;
}

function simpleName(node: Node): string {
  let name = "";
  const visit = (child: Node): boolean | void => {
    if (name) return false;
    if (child.type === "identifier") {
      name = child.text;
      return false;
    }
    for (const grandchild of child.children) visit(grandchild);
  };
  visit(node);
  return name;
}

function property(name: string): DeclarationReport["members"][number] {
  return {
    name,
    kind: "property",
    visibility: "public",
    static: false,
    abstract: false,
    readonly: false,
    optional: false,
  };
}

/** Collect `self.x = ...` / `cls.x = ...` assignments inside a method body. */
function selfAssignments(body: Node, out: DeclarationReport["members"]): void {
  const visit = (node: Node): void => {
    if (node.type === "assignment") {
      const left = node.childForFieldName("left");
      const target = left?.childForFieldName("object")?.text;
      const attribute = left?.childForFieldName("attribute")?.text;
      if (left?.type === "attribute" && (target === "self" || target === "cls") && attribute) {
        if (!out.some((member) => member.name === attribute)) out.push(property(attribute));
      }
    }
    for (const child of node.children) visit(child);
  };
  visit(body);
}

function membersOf(node: Node): DeclarationReport["members"] {
  const members: DeclarationReport["members"] = [];
  const body = node.childForFieldName("body");
  if (!body) return members;

  for (const child of body.namedChildren) {
    if (child.type === "function_definition") {
      const name = child.childForFieldName("name")?.text;
      if (name) {
        members.push({
          name,
          kind: name === "__init__" ? "constructor" : "method",
          visibility: name.startsWith("__") && !name.endsWith("__") ? "private" : "public",
          static: false,
          abstract: false,
          readonly: false,
          optional: false,
        });
      }
      const methodBody = child.childForFieldName("body");
      if (methodBody) selfAssignments(methodBody, members);
    } else if (child.type === "expression_statement") {
      const assignment = child.namedChildren[0];
      if (assignment?.type === "assignment") {
        const left = assignment.childForFieldName("left");
        if (left?.type === "identifier" && !members.some((m) => m.name === left.text)) {
          members.push(property(left.text));
        }
      }
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
    case "if_statement":
    case "elif_clause": {
      const branches: FlowBranch[] = [
        { label: "then", body: blockFlow(node.childForFieldName("consequence")) },
      ];
      const alternative = node.childForFieldName("alternative");
      if (alternative) branches.push({ label: "else", body: blockFlow(alternative) });
      return { kind: "decision", branches };
    }
    case "match_statement":
      return { kind: "decision", branches: [] };
    case "for_statement":
    case "while_statement":
      return {
        kind: "loop",
        label: firstLine(node.text),
        body: blockFlow(node.childForFieldName("body")),
      };
    case "return_statement":
    case "raise_statement":
      return { kind: "terminator", text: firstLine(node.text) };
    default:
      return { kind: "action", text: firstLine(node.text) };
  }
}

export const PYTHON_PROFILE: AnalyzerProfile = {
  functionTypes: FUNCTION_TYPES,
  functionShape(node, enclosing): FunctionShape | undefined {
    const body = node.childForFieldName("body");
    const name = node.childForFieldName("name")?.text;
    if (!body || !name) return undefined;
    const kind =
      !enclosing ? "function" : name === "__init__" ? "constructor" : "method";
    return {
      node,
      body,
      name,
      ...(enclosing ? { owner: enclosing } : {}),
      params: parameterCount(node, enclosing),
      kind,
    };
  },

  decisionTypes: DECISION_TYPES,
  logicalDecision(node) {
    if (node.type !== "boolean_operator") return false;
    const operator = node.childForFieldName("operator")?.text;
    return operator !== undefined && LOGICAL_OPERATORS.has(operator);
  },
  nestingTypes: NESTING_TYPES,
  statementTypes: STATEMENT_TYPES,
  cognitive: {
    ifTypes: new Set(["if_statement"]),
    elifTypes: new Set(["elif_clause"]),
    loopTypes: LOOP_TYPES,
    switchTypes: new Set(["match_statement"]),
    catchTypes: new Set(["except_clause"]),
    ternaryTypes: new Set(["conditional_expression"]),
    ifCondition: (node) => node.childForFieldName("condition"),
    ifConsequence: (node) => node.childForFieldName("consequence"),
    ifAlternative: (node) => node.childForFieldName("alternative"),
    isElseIf: (node) => node.parent?.type === "elif_clause",
    isPlainElse: (node) => node.childForFieldName("alternative")?.type === "else_clause",
    logicalOperator: (node) =>
      node.type === "boolean_operator"
        ? node.childForFieldName("operator")?.text
        : undefined,
  },

  operatorTypes: OPERATOR_TYPES,
  operandTypes: OPERAND_TYPES,

  commentTypes: new Set(["comment"]),

  importTypes: new Set(["import_statement", "import_from_statement"]),
  importModule(node) {
    if (node.type === "import_from_statement") {
      return node.childForFieldName("module_name")?.text;
    }
    return node.childForFieldName("name")?.text;
  },

  callTypes: new Set(["call"]),
  calleeName: (node) => node.childForFieldName("function")?.text,

  declarationTypes: DECLARATION_TYPES,
  declaration(node, path) {
    const name = node.childForFieldName("name")?.text;
    if (!name) return undefined;
    const line = node.startPosition.row + 1;
    return {
      id: `${path}:${line}:${name}`,
      name,
      kind: "class",
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
