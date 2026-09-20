import type { Thresholds } from "@meowanalyze/core";
import { button, el } from "./dom.js";

const FIELDS: Array<[keyof Thresholds, string, string]> = [
  ["cyclomatic", "Cyclomatic", "Max cyclomatic complexity per function"],
  ["cognitive", "Cognitive", "Max cognitive complexity per function"],
  ["nesting", "Nesting", "Max nesting depth per function"],
  ["params", "Parameters", "Max parameters per function"],
  ["functionLoc", "Function length", "Max physical lines per function"],
  ["fileLoc", "File length", "Max physical lines per file"],
];

/** Open a modal with the threshold settings. */
export function openSettings(
  current: Thresholds,
  onApply: (thresholds: Thresholds) => void,
): void {
  const overlay = el("div", { class: "modal-overlay" });
  const inputs = new Map<keyof Thresholds, HTMLInputElement>();

  const grid = el("div", { class: "modal__grid" });
  for (const [key, label, hint] of FIELDS) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = String(current[key]);
    inputs.set(key, input);
    grid.append(
      el("label", { class: "field", title: hint }, el("span", { text: label }), input),
    );
  }

  const close = (): void => {
    overlay.classList.remove("modal-overlay--open");
    window.setTimeout(() => overlay.remove(), 200);
    document.removeEventListener("keydown", onKey);
  };

  const apply = (): void => {
    const next = { ...current };
    for (const [key, input] of inputs) {
      const value = Number.parseInt(input.value, 10);
      if (Number.isFinite(value) && value >= 0) next[key] = value;
    }
    onApply(next);
    close();
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };

  const modal = el(
    "div",
    { class: "modal" },
    el("h2", { class: "modal__title", text: "Settings" }),
    el("p", { class: "modal__hint", text: "Thresholds flag functions that exceed them." }),
    grid,
    el(
      "div",
      { class: "modal__actions" },
      button("Cancel", close),
      button("Apply", apply, "button--primary"),
    ),
  );

  overlay.append(modal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => overlay.classList.add("modal-overlay--open"));
  } else {
    overlay.classList.add("modal-overlay--open");
  }
}
