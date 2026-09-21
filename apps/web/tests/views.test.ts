// @vitest-environment jsdom
import { analyzeSources, DEFAULT_THRESHOLDS, type AnalysisReport } from "@meowanalyze/core";
import { describe, expect, it, vi } from "vitest";
import { renderSettings } from "../src/settings.js";
import { defaultPrefs } from "../src/prefs.js";
import { renderDashboard } from "../src/views/dashboard.js";
import { renderDetail } from "../src/views/detail.js";
import { disposeDiagrams, renderDiagrams } from "../src/views/diagrams.js";
import { renderHelp } from "../src/views/help.js";
import { renderLanding } from "../src/views/landing.js";

const SOURCE = `export function simple(a: number) {
  return a + 1;
}

export function branchy(n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0 && i > 2) {
      total += i;
    }
  }
  return total;
}
`;

function sampleReport(): AnalysisReport {
  return analyzeSources({
    root: "sample",
    sources: [
      { path: "src/a.ts", content: SOURCE },
      { path: "src/deep/b.ts", content: "export const b = 2;\n" },
    ],
  });
}

function targets(): { head: HTMLElement; body: HTMLElement } {
  return { head: document.createElement("div"), body: document.createElement("div") };
}

describe("landing view", () => {
  it("shows only the open-folder action", () => {
    const root = document.createElement("div");
    renderLanding(root, { onFolder: vi.fn() });

    expect(root.querySelectorAll("button.button")).toHaveLength(1);
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("textarea")).toBeNull();
  });
});

describe("dashboard view", () => {
  it("renders one card per enabled module", () => {
    const view = targets();
    renderDashboard(view, sampleReport(), { onJump: vi.fn() });

    const defaults = defaultPrefs();
    const count = Object.values(defaults.modules).filter(Boolean).length;

    expect(view.head.querySelector(".page__head")).not.toBeNull();
    expect(view.body.querySelector(".stats-grid")).not.toBeNull();
    expect(view.body.querySelectorAll(".kpi")).toHaveLength(count);
  });

  it("honors dashboard preferences", () => {
    const view = targets();
    const prefs = defaultPrefs();
    for (const id of Object.keys(prefs.modules)) prefs.modules[id] = false;
    renderDashboard(view, sampleReport(), { onJump: vi.fn() }, prefs);
    expect(view.body.querySelectorAll(".kpi")).toHaveLength(0);

    for (const id of Object.keys(prefs.modules)) prefs.modules[id] = true;
    renderDashboard(view, sampleReport(), { onJump: vi.fn() }, prefs);
    expect(view.body.querySelectorAll(".kpi").length).toBeGreaterThan(6);
  });
});

describe("help view", () => {
  it("lists metric sections with formula placeholders", () => {
    const view = targets();
    renderHelp(view);
    expect(view.head.querySelector(".page__head")).not.toBeNull();
    expect(view.body.querySelector(".help-page")).not.toBeNull();
    expect(view.body.querySelectorAll(".card").length).toBeGreaterThanOrEqual(8);
    expect(view.body.querySelectorAll(".math").length).toBeGreaterThanOrEqual(8);
  });
});

describe("diagrams view", () => {
  it("renders the toolbar and the draw.io stage", () => {
    const view = targets();
    renderDiagrams(view, sampleReport());
    expect(view.head.querySelector(".page__head")).not.toBeNull();
    expect(view.body.querySelectorAll(".diagram-kind").length).toBe(5);
    expect(view.body.querySelector(".diagram-stage")).not.toBeNull();
    disposeDiagrams();
  });
});

describe("detail view", () => {
  it("lists files and previews the selected one", () => {
    const report = sampleReport();
    const view = targets();
    const onSelect = vi.fn();
    renderDetail(view, report, [{ path: "src/a.ts", content: SOURCE }], "src/a.ts", {
      onSelect,
    });

    expect(view.body.querySelectorAll(".file-list__item").length).toBe(2);
    expect(view.body.querySelectorAll(".source__line").length).toBeGreaterThan(0);

    view.body.querySelectorAll<HTMLElement>(".file-list__item")[1]?.click();
    expect(onSelect).toHaveBeenCalled();
  });

  it("locates and highlights a function in the source", () => {
    const report = sampleReport();
    const view = targets();
    renderDetail(view, report, [{ path: "src/a.ts", content: SOURCE }], "src/a.ts", {
      onSelect: vi.fn(),
    });

    view.body.querySelector<HTMLElement>(".link")?.click();
    expect(view.body.querySelectorAll(".source__line--active").length).toBeGreaterThan(0);
  });
});

describe("settings page", () => {
  it("applies edited thresholds and dashboard prefs", () => {
    const onApply = vi.fn();
    const view = targets();
    renderSettings(
      view,
      { thresholds: { ...DEFAULT_THRESHOLDS }, prefs: defaultPrefs() },
      { onApply },
    );

    expect(view.head.querySelector(".page__head")).not.toBeNull();
    const input = view.body.querySelector<HTMLInputElement>("input");
    if (input) input.value = "42";

    const firstToggle = view.body.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (firstToggle) firstToggle.checked = false;

    view.body.querySelector<HTMLButtonElement>("button.button--primary")?.click();

    expect(onApply).toHaveBeenCalledTimes(1);
    const values = onApply.mock.calls[0]?.[0];
    expect(values?.thresholds.cyclomatic).toBe(42);
    expect(values?.prefs.modules.maintainability).toBe(false);
  });
});
