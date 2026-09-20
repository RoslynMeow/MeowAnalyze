import type { Thresholds } from "@meowanalyze/core";
import { MODULES, type ModuleId } from "./dashboard-modules.js";
import { el, type ViewTargets } from "./dom.js";
import { t } from "./i18n.js";
import { defaultPrefs, type DashboardPrefs } from "./prefs.js";

const FIELD_KEYS: Array<keyof Thresholds> = [
  "cyclomatic",
  "cognitive",
  "nesting",
  "params",
  "functionLoc",
  "fileLoc",
];

export interface SettingsValues {
  thresholds: Thresholds;
  prefs: DashboardPrefs;
}

export interface SettingsHandlers {
  onApply: (values: SettingsValues) => void;
}

/** Render the settings page: thresholds plus which dashboard cards show. */
export function renderSettings(
  targets: ViewTargets,
  values: SettingsValues,
  handlers: SettingsHandlers,
): void {
  const strings = t();
  targets.head.replaceChildren(
    el(
      "header",
      { class: "page__head" },
      el("h1", { class: "page__title", text: strings.settings.title }),
    ),
  );

  const inputs = new Map<keyof Thresholds, HTMLInputElement>();
  const grid = el("div", { class: "settings-grid" });
  for (const key of FIELD_KEYS) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = String(values.thresholds[key]);
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

  const toggleInputs = new Map<string, HTMLInputElement>();
  const toggleGrid = el("div", { class: "toggle-grid" });
  for (const module of MODULES) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = values.prefs.modules[module.id] ?? false;
    toggleInputs.set(module.id, input);
    toggleGrid.append(
      el("label", { class: "toggle" }, input, el("span", { text: moduleLabel(module.id) })),
    );
  }

  const resetBtn = el("button", {
    class: "button",
    text: strings.settings.reset,
    onClick: () => {
      const defaults = defaultPrefs();
      for (const [id, input] of toggleInputs) input.checked = defaults.modules[id] ?? false;
    },
  });
  resetBtn.type = "button";

  const applyBtn = el("button", {
    class: "button button--primary",
    text: strings.common.apply,
    onClick: () => {
      const thresholds = { ...values.thresholds };
      for (const [key, input] of inputs) {
        const value = Number.parseInt(input.value, 10);
        if (Number.isFinite(value) && value >= 0) thresholds[key] = value;
      }
      const modules: Record<string, boolean> = {};
      for (const [id, input] of toggleInputs) modules[id] = input.checked;
      handlers.onApply({ thresholds, prefs: { modules } });
    },
  });
  applyBtn.type = "button";

  const body = el(
    "div",
    { class: "settings-page" },
    el(
      "section",
      { class: "card" },
      el("h2", { text: strings.settings.title }),
      el("p", { class: "card__hint", text: strings.settings.hint }),
      grid,
    ),
    el(
      "section",
      { class: "card" },
      el("h2", { text: strings.settings.dashboardTitle }),
      el("p", { class: "card__hint", text: strings.settings.dashboardHint }),
      toggleGrid,
    ),
    el("div", { class: "settings-actions" }, resetBtn, applyBtn),
  );

  targets.body.replaceChildren(body);
}

function moduleLabel(id: ModuleId): string {
  const k = t().dashboard.kpi;
  const c = t().dashboard.charts;
  switch (id) {
    case "maintainability":
      return k.maintainability;
    case "scale":
      return k.scale;
    case "cyclomatic":
      return k.maxCyclomatic;
    case "cognitive":
      return k.maxCognitive;
    case "nesting":
      return k.maxNesting;
    case "functionLength":
      return k.avgFunctionLength;
    case "params":
      return k.params;
    case "halsteadVolume":
      return k.halsteadVolume;
    case "halsteadDifficulty":
      return k.halsteadDifficulty;
    case "loc":
      return c.linesOfCode;
    case "logicalLines":
      return k.logicalLines;
    case "commentPct":
      return k.commentPct;
    case "languages":
      return c.languages;
    case "functionKinds":
      return c.functionKinds;
    case "markers":
      return k.markers;
    case "violations":
      return k.violations;
  }
}
