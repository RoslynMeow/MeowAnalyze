export type Child = Node | string | number | null | undefined;

/** Where a view renders: a per-page header (shown in the top bar) and the body. */
export interface ViewTargets {
  head: HTMLElement;
  body: HTMLElement;
}

export interface ElProps {
  class?: string;
  text?: string;
  title?: string;
  onClick?: (event: MouseEvent) => void;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.title) node.title = props.title;
  if (props.onClick) {
    node.addEventListener("click", (event) => props.onClick?.(event as MouseEvent));
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : child,
    );
  }
  return node;
}

export function card(title: string, ...children: Child[]): HTMLElement {
  return el("section", { class: "card" }, el("h2", { text: title }), ...children);
}

export function button(label: string, onClick: () => void, kind = ""): HTMLButtonElement {
  const node = el("button", { class: `button ${kind}`.trim(), text: label });
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Small stroked line icon built from one or more path `d` strings. */
export function icon(paths: readonly string[], size = 18): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export const HOME_ICON = ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5"];

export const MENU_ICON = ["M4 7h16", "M4 12h16", "M4 17h16"];

/** Animated integer count-up. Falls back to the final value without rAF. */
export function countUp(node: HTMLElement, to: number, duration = 800): void {
  if (typeof requestAnimationFrame !== "function") {
    node.textContent = String(to);
    return;
  }
  const start = performance.now();
  const step = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = String(Math.round(to * eased));
    if (t < 1) requestAnimationFrame(step);
    else node.textContent = String(to);
  };
  requestAnimationFrame(step);
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
