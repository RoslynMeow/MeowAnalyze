/**
 * A broad, language-agnostic profile that works "well enough" for the many
 * tree-sitter grammars that follow common naming conventions. Tuned profiles
 * (C/C++, Python, Java, C#) override it for accuracy; everything else uses this
 * as a best-effort baseline, which the docs mark as "basic" support.
 *
 * Extra node names in these sets are harmless (they are simple membership
 * tests); missing names only cause a metric to undercount.
 */
import type { DeclarationReport, FlowBranch, FlowNode } from "../../report/model.js";
import type { AnalyzerProfile, CognitiveRules, FunctionShape, Node } from "./analyzer.js";

const FUNCTION_TYPES = new Set([
  "function_definition",
  "function_declaration",
  "function_item",
  "function_statement",
  "function_expression",
  "local_function_declaration",
  "local_function_statement",
  "method_definition",
  "method_declaration",
  "method",
  "constructor_declaration",
  "constructor_definition",
  "procedure_declaration",
  "procedure_definition",
  "subroutine",
  "singleton_method",
  "arrow_function",
  "anonymous_function",
  "lambda_expression",
  "function_binding",
]);

const CONTAINER_TYPES = new Set([
  "class_declaration",
  "class_definition",
  "class",
  "struct_declaration",
  "struct_definition",
  "struct_specifier",
  "struct_item",
  "interface_declaration",
  "interface_definition",
  "enum_declaration",
  "enum_definition",
  "enum_specifier",
  "enum_item",
  "trait_item",
  "impl_item",
  "record_declaration",
  "union_specifier",
  "class_specifier",
  "module",
  "object_declaration",
  "namespace_declaration",
]);

const DECLARATION_TYPES = CONTAINER_TYPES;

const LOOP_TYPES = new Set([
  "for_statement",
  "for_expression",
  "for_in_statement",
  "for_range_loop",
  "enhanced_for_statement",
  "for_each_statement",
  "foreach_statement",
  "c_style_for_statement",
  "while_statement",
  "while_expression",
  "do_statement",
  "do_expression",
  "loop_expression",
  "repeat_statement",
  "repeat_expression",
]);

const SWITCH_TYPES = new Set([
  "switch_statement",
  "switch_expression",
  "match_statement",
  "match_expression",
  "case_statement",
  "when_statement",
  "select_statement",
]);

const CATCH_TYPES = new Set(["catch_clause", "except_clause", "rescue_clause", "rescue"]);

const TERNARY_TYPES = new Set(["conditional_expression", "ternary_expression"]);

// Only named node types belong here — anonymous keyword tokens (e.g. the `if`
// token) share these names and would otherwise be double-counted.
const IF_TYPES = new Set(["if_statement", "if_expression"]);

const DECISION_EXTRA = new Set([
  "switch_label",
  "switch_section",
  "switch_case",
  "case_clause",
  "match_arm",
  "when_clause",
  "elsif",
  "elif_clause",
  "guard_clause",
  "selector_clause",
]);

const NESTING_EXTRA = new Set([
  "try_statement",
  "try_expression",
  "using_statement",
  "with_statement",
  "lock_statement",
  "synchronized_statement",
  "catch_clause",
  "except_clause",
  "rescue_clause",
  "do_block",
]);

const STATEMENT_TYPES = new Set([
  "expression_statement",
  "expression_statement_2",
  "return_statement",
  "return_expression",
  "throw_statement",
  "throw_expression",
  "raise_statement",
  "break_statement",
  "continue_statement",
  "yield_statement",
  "pass_statement",
  "assert_statement",
  "assignment",
  "assignment_statement",
  "local_variable_declaration",
  "local_declaration_statement",
  "declaration",
  "variable_declaration",
  "let_declaration",
  "if_statement",
  ...LOOP_TYPES,
  ...SWITCH_TYPES,
  "try_statement",
  "try_expression",
  "using_statement",
  "with_statement",
  "case_clause",
  "match_arm",
]);

const OPERATOR_TYPES = new Set([
  "binary_expression",
  "binary_operator",
  "boolean_operator",
  "unary_expression",
  "unary_operator",
  "not_operator",
  "update_expression",
  "assignment_expression",
  "augmented_assignment",
  "conditional_expression",
  "ternary_expression",
  "comparison_operator",
  "call_expression",
  "call",
  "invocation_expression",
  "method_invocation",
  "function_call",
  "subscript_expression",
  "subscript",
  "element_access_expression",
  "field_expression",
  "field_access",
  "member_access_expression",
  "attribute",
  "cast_expression",
  "pointer_expression",
  "sizeof_expression",
  "range_expression",
]);

const OPERAND_TYPES = new Set([
  "identifier",
  "field_identifier",
  "type_identifier",
  "simple_identifier",
  "constant",
  "integer_literal",
  "decimal_integer_literal",
  "hex_integer_literal",
  "float_literal",
  "real_literal",
  "decimal_floating_point_literal",
  "number",
  "number_literal",
  "string_literal",
  "string",
  "char_literal",
  "character_literal",
  "true",
  "false",
  "boolean_literal",
  "null",
  "nil",
  "none",
  "null_literal",
  "this",
  "self",
]);

const COMMENT_TYPES = new Set([
  "comment",
  "line_comment",
  "block_comment",
  "documentation_comment",
  "doc_comment",
]);

const IMPORT_TYPES = new Set([
  "import_declaration",
  "import_statement",
  "import_from_statement",
  "import_or_export",
  "import_specification",
  "library_import",
  "using_directive",
  "using_declaration",
  "use_declaration",
  "use_item",
  "preproc_include",
  "require",
  "package_clause",
  "package_declaration",
  "namespace_use_declaration",
  "include_statement",
]);

const CALL_TYPES = new Set([
  "call_expression",
  "call",
  "function_call",
  "method_invocation",
  "invocation_expression",
  "call_expression_2",
  "macro_invocation",
  "constructor_invocation",
]);

function firstLine(text: string, max = 60): string {
  const line = text.split("\n", 1)[0]?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function simpleName(node: Node): string {
  const field = node.childForFieldName("name");
  if (field) return field.text;
  let name = "";
  const visit = (child: Node): boolean | void => {
    if (name) return false;
    if (
      child.type === "identifier" ||
      child.type === "field_identifier" ||
      child.type === "type_identifier" ||
      child.type === "simple_identifier"
    ) {
      name = child.text;
      return false;
    }
    for (const grandchild of child.children) visit(grandchild);
  };
  visit(node);
  return name;
}

function parameterField(node: Node): Node | null {
  return (
    node.childForFieldName("parameters") ??
    node.childForFieldName("parameter_list") ??
    node.childForFieldName("formal_parameters") ??
    node.children.find((child) =>
      ["parameters", "parameter_list", "formal_parameters"].includes(child.type),
    ) ??
    null
  );
}

function bodyField(node: Node): Node | null {
  return (
    node.childForFieldName("body") ??
    node.childForFieldName("block") ??
    node.children.find((child) =>
      ["block", "compound_statement", "function_body", "do_block"].includes(child.type),
    ) ??
    null
  );
}

function genericFunctionShape(
  node: Node,
  enclosing: string | undefined,
): FunctionShape | undefined {
  const body = bodyField(node);
  if (!body) return undefined;
  const name = simpleName(node) || "<anonymous>";
  const isConstructor = node.type.includes("constructor");
  const kind = isConstructor ? "constructor" : enclosing ? "method" : "function";
  return {
    node,
    body,
    name,
    ...(enclosing ? { owner: enclosing } : {}),
    params: parameterField(node)?.namedChildCount ?? 0,
    kind,
  };
}

function genericDeclaration(node: Node, path: string): DeclarationReport | undefined {
  const name = node.childForFieldName("name")?.text ?? simpleName(node);
  if (!name) return undefined;
  const line = node.startPosition.row + 1;
  const kind =
    node.type.includes("interface")
      ? "interface"
      : node.type.includes("enum")
        ? "enum"
        : "class";
  const members: DeclarationReport["members"] = [];
  const body = node.childForFieldName("body");
  if (body) {
    for (const child of body.namedChildren) {
      if (FUNCTION_TYPES.has(child.type)) {
        const memberName = child.childForFieldName("name")?.text ?? simpleName(child);
        if (memberName) {
          members.push({
            name: memberName,
            kind: "method",
            visibility: "public",
            static: false,
            abstract: false,
            readonly: false,
            optional: false,
          });
        }
      } else if (child.type.includes("field") || child.type.includes("variable")) {
        const memberName = simpleName(child);
        if (memberName) {
          members.push({
            name: memberName,
            kind: "property",
            visibility: "public",
            static: false,
            abstract: false,
            readonly: false,
            optional: false,
          });
        }
      }
    }
  }
  return { id: `${path}:${line}:${name}`, name, kind, path, line, abstract: false, extends: [], implements: [], members };
}

function flowChildren(list: Iterable<Node>): FlowNode[] {
  const out: FlowNode[] = [];
  for (const child of list) {
    const flow = genericFlowNode(child);
    if (flow) out.push(flow);
  }
  return out;
}

function genericFlowNode(node: Node): FlowNode | undefined {
  if (IF_TYPES.has(node.type)) {
    const branches: FlowBranch[] = [
      { label: "then", body: flowChildren(node.childForFieldName("consequence")?.namedChildren ?? []) },
    ];
    const alternative = node.childForFieldName("alternative");
    if (alternative) branches.push({ label: "else", body: flowChildren([alternative]) });
    return { kind: "decision", branches };
  }
  if (LOOP_TYPES.has(node.type)) {
    return {
      kind: "loop",
      label: firstLine(node.text),
      body: flowChildren(bodyField(node)?.namedChildren ?? []),
    };
  }
  if (/return|throw|raise/.test(node.type)) {
    return { kind: "terminator", text: firstLine(node.text) };
  }
  if (node.type.includes("statement") || node.type.includes("expression")) {
    return { kind: "action", text: firstLine(node.text) };
  }
  return undefined;
}

export const GENERIC_PROFILE: AnalyzerProfile = {
  functionTypes: FUNCTION_TYPES,
  functionShape: genericFunctionShape,

  decisionTypes: new Set([...IF_TYPES, ...LOOP_TYPES, ...DECISION_EXTRA, ...CATCH_TYPES, ...TERNARY_TYPES]),
  logicalDecision(node) {
    const operator = node.childForFieldName("operator")?.text;
    return operator === "&&" || operator === "||" || operator === "and" || operator === "or";
  },
  nestingTypes: new Set([...IF_TYPES, ...LOOP_TYPES, ...SWITCH_TYPES, ...NESTING_EXTRA]),
  statementTypes: STATEMENT_TYPES,
  cognitive: {
    ifTypes: IF_TYPES,
    elifTypes: new Set(["elif_clause", "elsif", "else_if"]),
    loopTypes: LOOP_TYPES,
    switchTypes: SWITCH_TYPES,
    catchTypes: CATCH_TYPES,
    ternaryTypes: TERNARY_TYPES,
    ifCondition: (node) => node.childForFieldName("condition"),
    ifConsequence: (node) => node.childForFieldName("consequence") ?? node.childForFieldName("body"),
    ifAlternative: (node) => node.childForFieldName("alternative"),
    isElseIf: (node) => node.parent?.type === "else_clause",
    isPlainElse: (node) => {
      const alternative = node.childForFieldName("alternative");
      return !!alternative && !IF_TYPES.has(alternative.type);
    },
    logicalOperator: (node) => {
      const operator = node.childForFieldName("operator")?.text;
      return operator === "&&" || operator === "||" || operator === "and" || operator === "or"
        ? operator
        : undefined;
    },
  },

  operatorTypes: OPERATOR_TYPES,
  operandTypes: OPERAND_TYPES,

  commentTypes: COMMENT_TYPES,

  importTypes: IMPORT_TYPES,
  importModule(node) {
    return node.text.replace(/[;{}]/g, " ").replace(/\s+/g, " ").trim();
  },

  callTypes: CALL_TYPES,
  calleeName(node) {
    const target =
      node.childForFieldName("function") ??
      node.childForFieldName("name") ??
      node.childForFieldName("method");
    return target?.text ?? node.namedChildren[0]?.text;
  },

  declarationTypes: DECLARATION_TYPES,
  declaration: genericDeclaration,

  containerTypes: CONTAINER_TYPES,
  containerName: (node) => node.childForFieldName("name")?.text ?? simpleName(node),

  flowNode: genericFlowNode,
};

type ProfileOverrides = Partial<Omit<AnalyzerProfile, "cognitive">> & {
  cognitive?: Partial<CognitiveRules>;
};

/** A language profile is the generic one with a few node-type sets overridden. */
export function defineProfile(overrides: ProfileOverrides): AnalyzerProfile {
  return {
    ...GENERIC_PROFILE,
    ...overrides,
    cognitive: { ...GENERIC_PROFILE.cognitive, ...(overrides.cognitive ?? {}) },
  };
}
