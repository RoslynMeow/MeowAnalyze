// @vitest-environment jsdom
import { analyzeSources, DEFAULT_THRESHOLDS, type AnalysisReport } from "@meowanalyze/core";
import { describe, expect, it, vi } from "vitest";
import { openSettings } from "../src/settings.js";
import { renderDashboard } from "../src/views/dashboard.js";
import { renderDetail } from "../src/views/detail.js";
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
  it("renders a data-only dashboard with stats and donut charts", () => {
    const view = targets();
    renderDashboard(view, sampleReport(), {
      onOpenFile: vi.fn(),
      onExport: vi.fn(),
      onOpenSettings: vi.fn(),
    });

    expect(view.head.querySelector(".page__head")).not.toBeNull();
    expect(view.body.querySelectorAll(".kpi").length).toBeGreaterThanOrEqual(10);
    expect(view.body.querySelector(".stats-grid")).not.toBeNull();
    expect(view.body.querySelectorAll(".donut-card").length).toBeGreaterThanOrEqual(7);
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

describe("settings modal", () => {
  it("applies edited thresholds", () => {
    const onApply = vi.fn();
    openSettings({ ...DEFAULT_THRESHOLDS }, onApply);

    const overlay = document.querySelector<HTMLElement>(".modal-overlay");
    expect(overlay).not.toBeNull();
    const input = overlay?.querySelector<HTMLInputElement>("input");
    if (input) input.value = "42";

    overlay?.querySelector<HTMLButtonElement>("button.button--primary")?.click();

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]?.[0]?.cyclomatic).toBe(42);
    overlay?.remove();
  });
});
