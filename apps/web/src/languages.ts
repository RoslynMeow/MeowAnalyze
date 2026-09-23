import { TREE_SITTER_LANGUAGES } from "@meowanalyze/core";
import { icon } from "./dom.js";
import { getTheme } from "./theme.js";
import {
  siC,
  siCplusplus,
  siCss,
  siDotnet,
  siElixir,
  siGnubash,
  siGnuemacs,
  siGo,
  siHtml5,
  siJavascript,
  siJson,
  siKotlin,
  siLua,
  siOcaml,
  siOpenjdk,
  siPhp,
  siPython,
  siRescript,
  siRuby,
  siRust,
  siScala,
  siSolidity,
  siSwift,
  siToml,
  siTypescript,
  siVuedotjs,
  siZig,
  type SimpleIcon,
} from "simple-icons";

/** How much of the analysis applies to a language. */
export type LanguageGroup = "tuned" | "basic" | "files";

export interface SupportedLanguage {
  id: string;
  name: string;
  /** Brand logo when simple-icons ships one; some languages have none. */
  icon?: SimpleIcon;
  group: LanguageGroup;
}

/** Languages the analyzer currently understands. */
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  // tuned: dedicated rules, all metrics trustworthy
  { id: "typescript", name: "TypeScript", icon: siTypescript, group: "tuned" },
  { id: "javascript", name: "JavaScript", icon: siJavascript, group: "tuned" },
  { id: "c", name: "C", icon: siC, group: "tuned" },
  { id: "cpp", name: "C++", icon: siCplusplus, group: "tuned" },
  { id: "csharp", name: "C#", icon: siDotnet, group: "tuned" },
  { id: "java", name: "Java", icon: siOpenjdk, group: "tuned" },
  { id: "python", name: "Python", icon: siPython, group: "tuned" },
  { id: "go", name: "Go", icon: siGo, group: "tuned" },

  // basic: generic tree-sitter rules, best effort
  { id: "rust", name: "Rust", icon: siRust, group: "basic" },
  { id: "ruby", name: "Ruby", icon: siRuby, group: "basic" },
  { id: "php", name: "PHP", icon: siPhp, group: "basic" },
  { id: "kotlin", name: "Kotlin", icon: siKotlin, group: "basic" },
  { id: "swift", name: "Swift", icon: siSwift, group: "basic" },
  { id: "scala", name: "Scala", icon: siScala, group: "basic" },
  { id: "lua", name: "Lua", icon: siLua, group: "basic" },
  { id: "zig", name: "Zig", icon: siZig, group: "basic" },
  { id: "solidity", name: "Solidity", icon: siSolidity, group: "basic" },
  { id: "objc", name: "Objective-C", group: "basic" },
  { id: "bash", name: "Shell", icon: siGnubash, group: "basic" },
  { id: "elixir", name: "Elixir", icon: siElixir, group: "basic" },
  { id: "elisp", name: "Emacs Lisp", icon: siGnuemacs, group: "basic" },
  { id: "ocaml", name: "OCaml", icon: siOcaml, group: "basic" },
  { id: "rescript", name: "ReScript", icon: siRescript, group: "basic" },
  { id: "tlaplus", name: "TLA+", group: "basic" },

  // files: no functions, only files / code lines / language share
  { id: "html", name: "HTML", icon: siHtml5, group: "files" },
  { id: "css", name: "CSS", icon: siCss, group: "files" },
  { id: "json", name: "JSON", icon: siJson, group: "files" },
  { id: "toml", name: "TOML", icon: siToml, group: "files" },
  { id: "vue", name: "Vue", icon: siVuedotjs, group: "files" },
  { id: "systemrdl", name: "SystemRDL", group: "files" },
  { id: "embedded_template", name: "ERB", group: "files" },
];

const COMPILER_EXTENSIONS: Record<string, readonly string[]> = {
  typescript: [".ts", ".tsx", ".mts", ".cts"],
  javascript: [".js", ".jsx", ".mjs", ".cjs"],
};

/** File extensions a language claims (TS/JS come from the compiler, not tree-sitter). */
export function languageExtensions(id: string): readonly string[] {
  const known = COMPILER_EXTENSIONS[id];
  if (known) return known;
  return TREE_SITTER_LANGUAGES.find((language) => language.id === id)?.extensions ?? [];
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Some brand colours are near-black (Java, Rust, JSON, Lua, …) or near-white
 * (JavaScript) and vanish on one of the themes; fall back to the chip's own text
 * colour so every icon stays visible.
 */
function iconFill(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const dark = getTheme() === "dark";
  if ((dark && luminance < 0.22) || (!dark && luminance > 0.82)) return "currentColor";
  return `#${hex}`;
}

/** Render a simple-icons brand logo as an inline SVG. */
export function brandIcon(icon: SimpleIcon, size = 20): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", iconFill(icon.hex));
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", icon.path);
  svg.append(path);
  return svg;
}

/** A generic `<>` glyph for languages without a brand icon. */
const CODE_GLYPH = ["M9 6 4 12l5 6", "M15 6l5 6-5 6"];

/** The brand logo, or a generic code glyph when simple-icons has none. */
export function languageIcon(language: SupportedLanguage, size = 20): SVGSVGElement {
  return language.icon ? brandIcon(language.icon, size) : icon(CODE_GLYPH, size);
}
