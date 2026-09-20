import type { Thresholds } from "@meowanalyze/core";
import { button, el } from "./dom.js";
import { t } from "./i18n.js";

const FIELD_KEYS: Array<keyof Thresholds> = [
  "cyclomatic",
  "cognitive",
  "nesting",
  "params",
  "functionLoc",
  "fileLoc",
];

/** Open a modal with the threshold settings. */
export function openSettings(
  current: Thresholds,
  onApply: (thresholds: Thresholds) => void,
): void {
  const strings = t();
  const overlay = el("div", { class: "modal-overlay" });
  const inputs = new Map<keyof Thresholds, HTMLInputElement>();

  const grid = el("div", { class: "modal__grid" });
  for (const key of FIELD_KEYS) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = String(current[key]);
    inputs.set(key, input);
    grid.append(
      el(
        "label",
        { class: "field", title: strings.settings.fieldHints[key] },
        el("span", { text: strings.settings.fields[key] }),
        input,
      ),
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
    el("h2", { class: "modal__title", text: strings.settings.title }),
    el("p", { class: "modal__hint", text: strings.settings.hint }),
    grid,
    el(
      "div",
      { class: "modal__actions" },
      button(strings.common.cancel, close),
      button(strings.common.apply, apply, "button--primary"),
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
