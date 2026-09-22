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

export interface SupportedLanguage {
  id: string;
  name: string;
  /** Brand logo when simple-icons ships one; some languages have none. */
  icon?: SimpleIcon;
}

/** Languages the analyzer currently understands. */
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { id: "typescript", name: "TypeScript", icon: siTypescript },
  { id: "javascript", name: "JavaScript", icon: siJavascript },
  { id: "c", name: "C", icon: siC },
  { id: "cpp", name: "C++", icon: siCplusplus },
  { id: "csharp", name: "C#", icon: siDotnet },
  { id: "java", name: "Java", icon: siOpenjdk },
  { id: "python", name: "Python", icon: siPython },
  { id: "go", name: "Go", icon: siGo },
  { id: "rust", name: "Rust", icon: siRust },
  { id: "ruby", name: "Ruby", icon: siRuby },
  { id: "php", name: "PHP", icon: siPhp },
  { id: "kotlin", name: "Kotlin", icon: siKotlin },
  { id: "swift", name: "Swift", icon: siSwift },
  { id: "scala", name: "Scala", icon: siScala },
  { id: "lua", name: "Lua", icon: siLua },
  { id: "zig", name: "Zig", icon: siZig },
  { id: "solidity", name: "Solidity", icon: siSolidity },
  { id: "objc", name: "Objective-C" },
  { id: "bash", name: "Shell", icon: siGnubash },
  { id: "elixir", name: "Elixir", icon: siElixir },
  { id: "elisp", name: "Emacs Lisp", icon: siGnuemacs },
  { id: "ocaml", name: "OCaml", icon: siOcaml },
  { id: "rescript", name: "ReScript", icon: siRescript },
  { id: "tlaplus", name: "TLA+" },
  { id: "html", name: "HTML", icon: siHtml5 },
  { id: "css", name: "CSS", icon: siCss },
  { id: "json", name: "JSON", icon: siJson },
  { id: "toml", name: "TOML", icon: siToml },
  { id: "vue", name: "Vue", icon: siVuedotjs },
  { id: "systemrdl", name: "SystemRDL" },
  { id: "embedded_template", name: "ERB" },
];

const SVG_NS = "http://www.w3.org/2000/svg";

/** Render a simple-icons brand logo as an inline SVG. */
export function brandIcon(icon: SimpleIcon, size = 20): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", `#${icon.hex}`);
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", icon.path);
  svg.append(path);
  return svg;
}
