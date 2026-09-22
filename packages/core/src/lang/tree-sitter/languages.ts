/**
 * Registry of tree-sitter languages. Tuned languages have a dedicated profile
 * (accurate metrics); the rest use the generic profile, which is a best-effort
 * baseline ("basic" support) documented in the README and the web Help page.
 *
 * The grammars must be ABI-compatible with the pinned `web-tree-sitter` (13–14);
 * e.g. the dart, elm, ql and yaml grammars are not, so they are not listed.
 */
import type { AnalyzerProfile } from "./analyzer.js";
import { C_CPP_PROFILE } from "./c-profile.js";
import { CSHARP_PROFILE } from "./csharp-profile.js";
import { defineProfile } from "./generic-profile.js";
import { JAVA_PROFILE } from "./java-profile.js";
import { PYTHON_PROFILE } from "./python-profile.js";

export type SupportTier = "tuned" | "basic";

export interface TreeSitterLanguageDef {
  id: string;
  grammar: string;
  extensions: readonly string[];
  tier: SupportTier;
  profile: AnalyzerProfile;
}

const s = (...names: string[]): ReadonlySet<string> => new Set(names);

export const TREE_SITTER_LANGUAGES: readonly TreeSitterLanguageDef[] = [
  // --- tuned ---------------------------------------------------------------
  { id: "c", grammar: "c", extensions: [".c", ".h"], tier: "tuned", profile: C_CPP_PROFILE },
  {
    id: "cpp",
    grammar: "cpp",
    extensions: [".cc", ".cpp", ".cxx", ".c++", ".hpp", ".hh", ".hxx", ".ipp", ".tpp", ".inl"],
    tier: "tuned",
    profile: C_CPP_PROFILE,
  },
  { id: "python", grammar: "python", extensions: [".py", ".pyi"], tier: "tuned", profile: PYTHON_PROFILE },
  { id: "java", grammar: "java", extensions: [".java"], tier: "tuned", profile: JAVA_PROFILE },
  { id: "csharp", grammar: "csharp", extensions: [".cs"], tier: "tuned", profile: CSHARP_PROFILE },

  // --- basic (generic profile) --------------------------------------------
  {
    id: "go",
    grammar: "go",
    extensions: [".go"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_declaration", "method_declaration"),
      containerTypes: s("type_declaration", "type_spec"),
      declarationTypes: s("type_declaration"),
      commentTypes: s("comment"),
      importTypes: s("import_declaration", "package_clause"),
      callTypes: s("call_expression"),
    }),
  },
  {
    id: "rust",
    grammar: "rust",
    extensions: [".rs"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_item"),
      containerTypes: s("struct_item", "enum_item", "trait_item", "impl_item"),
      declarationTypes: s("struct_item", "enum_item", "trait_item"),
      commentTypes: s("line_comment", "block_comment"),
      importTypes: s("use_declaration"),
      callTypes: s("call_expression", "macro_invocation"),
      cognitive: { ifTypes: s("if_expression"), switchTypes: s("match_expression") },
    }),
  },
  {
    id: "ruby",
    grammar: "ruby",
    extensions: [".rb"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("method", "singleton_method"),
      containerTypes: s("class", "module"),
      declarationTypes: s("class", "module"),
      commentTypes: s("comment"),
      callTypes: s("call"),
      cognitive: {
        ifTypes: s("if", "unless"),
        elifTypes: s("elsif"),
        loopTypes: s("while", "until", "for"),
        switchTypes: s("case"),
      },
    }),
  },
  {
    id: "php",
    grammar: "php",
    extensions: [".php"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_definition", "method_declaration", "arrow_function"),
      containerTypes: s("class_declaration", "interface_declaration", "enum_declaration", "trait_declaration"),
      declarationTypes: s("class_declaration", "interface_declaration", "enum_declaration", "trait_declaration"),
      commentTypes: s("comment"),
      importTypes: s("namespace_use_declaration"),
      callTypes: s("function_call_expression", "member_call_expression", "scoped_call_expression"),
    }),
  },
  {
    id: "kotlin",
    grammar: "kotlin",
    extensions: [".kt", ".kts"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_declaration", "anonymous_function"),
      containerTypes: s("class_declaration", "object_declaration"),
      declarationTypes: s("class_declaration", "object_declaration"),
      commentTypes: s("line_comment", "multiline_comment"),
      callTypes: s("call_expression", "constructor_invocation"),
      cognitive: { ifTypes: s("if_expression"), switchTypes: s("when_expression") },
    }),
  },
  {
    id: "swift",
    grammar: "swift",
    extensions: [".swift"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_declaration", "init_declaration"),
      containerTypes: s("class_declaration", "struct_declaration", "protocol_declaration"),
      declarationTypes: s("class_declaration", "struct_declaration", "enum_declaration", "protocol_declaration"),
      commentTypes: s("comment", "multiline_comment"),
      importTypes: s("import_declaration"),
      callTypes: s("call_expression"),
      cognitive: { loopTypes: s("for_statement", "while_statement", "repeat_while_statement") },
    }),
  },
  {
    id: "scala",
    grammar: "scala",
    extensions: [".scala", ".sc"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_definition", "function_declaration"),
      containerTypes: s("class_definition", "object_definition", "trait_definition"),
      declarationTypes: s("class_definition", "object_definition", "trait_definition"),
      commentTypes: s("comment"),
      importTypes: s("import_declaration"),
      callTypes: s("call_expression"),
      cognitive: {
        ifTypes: s("if_expression"),
        loopTypes: s("while_expression", "for_expression"),
        switchTypes: s("match_expression"),
      },
    }),
  },
  {
    id: "lua",
    grammar: "lua",
    extensions: [".lua"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_declaration", "function_definition"),
      commentTypes: s("comment"),
      callTypes: s("call"),
      cognitive: { loopTypes: s("while_statement", "repeat_statement", "do_statement") },
    }),
  },
  {
    id: "zig",
    grammar: "zig",
    extensions: [".zig"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_declaration"),
      containerTypes: s("struct_declaration", "enum_declaration"),
      declarationTypes: s("struct_declaration", "enum_declaration"),
      commentTypes: s("comment"),
      callTypes: s("call_expression"),
      cognitive: { ifTypes: s("if_statement", "if_expression"), switchTypes: s("switch_expression") },
    }),
  },
  {
    id: "solidity",
    grammar: "solidity",
    extensions: [".sol"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_definition"),
      containerTypes: s("contract_declaration", "interface_declaration", "struct_declaration", "enum_declaration"),
      declarationTypes: s("contract_declaration", "interface_declaration", "struct_declaration", "enum_declaration"),
      commentTypes: s("comment"),
      callTypes: s("call_expression"),
      cognitive: { loopTypes: s("for_statement", "while_statement") },
    }),
  },
  {
    id: "objc",
    grammar: "objc",
    extensions: [".m", ".mm"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_definition", "method_definition", "method_declaration"),
      containerTypes: s("class_declaration", "struct_specifier", "enum_specifier", "union_specifier"),
      declarationTypes: s("class_declaration", "struct_specifier", "enum_specifier"),
      commentTypes: s("comment"),
      importTypes: s("preproc_include"),
      callTypes: s("call_expression"),
    }),
  },
  {
    id: "bash",
    grammar: "bash",
    extensions: [".sh", ".bash"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_definition"),
      commentTypes: s("comment"),
      cognitive: { loopTypes: s("for_statement", "c_style_for_statement", "while_statement") },
    }),
  },
  {
    id: "elixir",
    grammar: "elixir",
    extensions: [".ex", ".exs"],
    tier: "basic",
    profile: defineProfile({
      commentTypes: s("comment"),
      callTypes: s("call"),
    }),
  },
  {
    id: "elisp",
    grammar: "elisp",
    extensions: [".el"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_definition"),
      commentTypes: s("comment"),
    }),
  },
  {
    id: "ocaml",
    grammar: "ocaml",
    extensions: [".ml", ".mli"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("value_definition", "function_expression"),
      commentTypes: s("comment"),
      cognitive: { switchTypes: s("match_expression") },
    }),
  },
  {
    id: "rescript",
    grammar: "rescript",
    extensions: [".res", ".resi"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("let_binding"),
      containerTypes: s("module_definition"),
      declarationTypes: s("module_definition"),
      commentTypes: s("comment"),
      callTypes: s("call_expression"),
      cognitive: { ifTypes: s("if_expression"), switchTypes: s("switch_expression") },
    }),
  },
  {
    id: "tlaplus",
    grammar: "tlaplus",
    extensions: [".tla"],
    tier: "basic",
    profile: defineProfile({
      functionTypes: s("function_definition"),
      commentTypes: s("comment", "block_comment"),
      callTypes: s("call"),
    }),
  },

  // --- markup / data: files, LOC and language share only -------------------
  { id: "html", grammar: "html", extensions: [".html", ".htm"], tier: "basic", profile: defineProfile({ commentTypes: s("comment") }) },
  { id: "css", grammar: "css", extensions: [".css"], tier: "basic", profile: defineProfile({ commentTypes: s("comment", "js_comment") }) },
  { id: "json", grammar: "json", extensions: [".json"], tier: "basic", profile: defineProfile({ commentTypes: s("comment") }) },
  { id: "toml", grammar: "toml", extensions: [".toml"], tier: "basic", profile: defineProfile({ commentTypes: s("comment") }) },
  { id: "vue", grammar: "vue", extensions: [".vue"], tier: "basic", profile: defineProfile({ commentTypes: s("comment") }) },
  {
    id: "embedded_template",
    grammar: "embedded_template",
    extensions: [".erb", ".ejs"],
    tier: "basic",
    profile: defineProfile({ commentTypes: s("comment") }),
  },
  { id: "systemrdl", grammar: "systemrdl", extensions: [".rdl"], tier: "basic", profile: defineProfile({ commentTypes: s("comment") }) },
];
