import { el } from "./dom.js";

let overlay: HTMLElement | undefined;
let labelNode: HTMLElement | undefined;
let barNode: HTMLElement | undefined;
let fillNode: HTMLElement | undefined;

function ensure(): void {
  if (overlay) return;
  labelNode = el("div", { class: "loading__label" });
  fillNode = el("div", { class: "loading__fill" });
  barNode = el("div", { class: "loading__bar" }, fillNode);
  const card = el(
    "div",
    { class: "loading__card" },
    el("div", { class: "loading__spinner" }),
    labelNode,
    barNode,
  );
  overlay = el("div", { class: "loading-overlay" }, card);
  document.body.append(overlay);
}

/** Show the loading overlay with an indeterminate bar. */
export function showLoading(label: string): void {
  ensure();
  setLoadingLabel(label);
  setLoadingProgress(0, 0);
  if (overlay) overlay.hidden = false;
}

export function setLoadingLabel(label: string): void {
  if (labelNode) labelNode.textContent = label;
}

/** `total <= 0` shows an indeterminate bar. */
export function setLoadingProgress(done: number, total: number): void {
  if (!barNode || !fillNode) return;
  if (total > 0) {
    barNode.classList.remove("loading__bar--indeterminate");
    fillNode.style.width = `${Math.min(100, (done / total) * 100).toFixed(1)}%`;
  } else {
    barNode.classList.add("loading__bar--indeterminate");
    fillNode.style.width = "";
  }
}

export function hideLoading(): void {
  if (overlay) overlay.hidden = true;
}
