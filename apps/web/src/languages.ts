import {
  siC,
  siCplusplus,
  siJavascript,
  siPython,
  siTypescript,
  type SimpleIcon,
} from "simple-icons";

export interface SupportedLanguage {
  id: string;
  name: string;
  icon: SimpleIcon;
}

/** Languages the analyzer currently understands. */
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { id: "typescript", name: "TypeScript", icon: siTypescript },
  { id: "javascript", name: "JavaScript", icon: siJavascript },
  { id: "c", name: "C", icon: siC },
  { id: "cpp", name: "C++", icon: siCplusplus },
  { id: "python", name: "Python", icon: siPython },
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
