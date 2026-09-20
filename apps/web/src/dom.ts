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
