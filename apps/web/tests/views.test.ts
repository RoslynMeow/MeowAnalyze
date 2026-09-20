// @vitest-environment jsdom
import { analyzeSources, DEFAULT_THRESHOLDS, type AnalysisReport } from "@meowanalyze/core";
import { describe, expect, it, vi } from "vitest";
import { openSettings } from "../src/settings.js";
import { renderDashboard } from "../src/views/dashboard.js";
import { renderDetail } from "../src/views/detail.js";
import { renderLanding } from "../src/views/landing.js";
import { buildTree, renderTreemap } from "../src/views/treemap.js";

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

describe("landing view", () => {
  it("shows the banner and only the open-folder option", () => {
    const root = document.createElement("div");
    renderLanding(root, { bannerUrl: "banner.svg", onFolder: vi.fn() });

    expect(root.querySelector("img.landing__banner")).not.toBeNull();
    expect(root.querySelectorAll("button.button")).toHaveLength(1);
    expect(root.querySelector("textarea")).toBeNull();
  });
});

describe("dashboard view", () => {
  it("renders KPIs, donut charts and the top-functions table", () => {
    const root = document.createElement("div");
    renderDashboard(root, sampleReport(), {
      onOpenFile: vi.fn(),
      onNewAnalysis: vi.fn(),
      onExport: vi.fn(),
      onOpenSettings: vi.fn(),
    });

    expect(root.querySelectorAll(".kpi").length).toBeGreaterThan(0);
    expect(root.querySelectorAll(".donut-card").length).toBe(4);
    expect(root.querySelector(".top-functions")).not.toBeNull();
  });

  it("opens a file from the top-functions table", () => {
    const root = document.createElement("div");
    const onOpenFile = vi.fn();
    renderDashboard(root, sampleReport(), {
      onOpenFile,
      onNewAnalysis: vi.fn(),
      onExport: vi.fn(),
      onOpenSettings: vi.fn(),
    });

    root.querySelector<HTMLElement>(".top-functions .link")?.click();
    expect(onOpenFile).toHaveBeenCalled();
  });
});

describe("treemap view", () => {
  it("builds a folder tree sized by code lines", () => {
    const tree = buildTree(sampleReport());
    expect(tree.value).toBeGreaterThan(0);
    const names = tree.children?.map((child) => child.name) ?? [];
    expect(names).toContain("src");
  });

  it("renders clickable cells", () => {
    const root = document.createElement("div");
    const onOpenFile = vi.fn();
    renderTreemap(root, sampleReport(), { onOpenFile });

    const cell = root.querySelector<SVGElement>("[data-key]");
    expect(cell).not.toBeNull();
    cell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onOpenFile).toHaveBeenCalled();
  });
});

describe("detail view", () => {
  it("lists files and previews the selected one", () => {
    const report = sampleReport();
    const root = document.createElement("div");
    const onSelect = vi.fn();
    renderDetail(
      root,
      report,
      [{ path: "src/a.ts", content: SOURCE }],
      "src/a.ts",
      { onSelect },
    );

    expect(root.querySelectorAll(".file-list__item").length).toBe(2);
    expect(root.querySelectorAll(".source__line").length).toBeGreaterThan(0);

    root.querySelectorAll<HTMLElement>(".file-list__item")[1]?.click();
    expect(onSelect).toHaveBeenCalled();
  });

  it("locates and highlights a function in the source", () => {
    const report = sampleReport();
    const root = document.createElement("div");
    renderDetail(root, report, [{ path: "src/a.ts", content: SOURCE }], "src/a.ts", {
      onSelect: vi.fn(),
    });

    root.querySelector<HTMLElement>(".link")?.click();
    expect(root.querySelectorAll(".source__line--active").length).toBeGreaterThan(0);
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
