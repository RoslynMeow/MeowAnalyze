import {
  faArrowsRotate,
  faDownload,
  faFileExport,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Build a Font Awesome solid icon as an inline SVG (no font files needed). */
export function faSvg(definition: IconDefinition, size = 15): SVGSVGElement {
  const [width, height, , , data] = definition.icon;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");

  const paths = Array.isArray(data) ? data : [data];
  for (const d of paths) {
    if (typeof d !== "string") continue;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export const ICON_RELOAD = faArrowsRotate;
export const ICON_DOWNLOAD = faDownload;
export const ICON_EXPORT = faFileExport;
