// @vitest-environment jsdom
import { analyzeSources, type AnalysisReport } from "@meowanalyze/core";
import { describe, expect, it, vi } from "vitest";
import { renderDashboard } from "../src/views/dashboard.js";
import { renderDetail } from "../src/views/detail.js";
import { renderLanding } from "../src/views/landing.js";
import { openSettings } from "../src/settings.js";
import { DEFAULT_THRESHOLDS } from "@meowanalyze/core";

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
    sources: [{ path: "src/a.ts", content: SOURCE }],
  });
}

describe("landing view", () => {
  it("shows the banner and only the open-folder option", () => {
    const root = document.createElement("div");
    renderLanding(root, {
      bannerUrl: "banner.svg",
      onFolder: vi.fn(),
    });

    expect(root.querySelector("img.landing__banner")).not.toBeNull();
    const buttons = root.querySelectorAll("button.button");
    expect(buttons).toHaveLength(1);
    expect(root.querySelector("textarea")).toBeNull();
  });
});

describe("dashboard view", () => {
  it("renders KPIs, charts and file cards", () => {
    const root = document.createElement("div");
    renderDashboard(root, sampleReport(), {
      onOpenFile: vi.fn(),
      onNewAnalysis: vi.fn(),
      onExport: vi.fn(),
      onOpenSettings: vi.fn(),
    });

    expect(root.querySelectorAll(".kpi").length).toBeGreaterThan(0);
    expect(root.querySelectorAll("svg.chart").length).toBeGreaterThan(0);
    expect(root.querySelectorAll(".file-card").length).toBeGreaterThan(0);
  });

  it("drills down when a file card is clicked", () => {
    const root = document.createElement("div");
    const onOpenFile = vi.fn();
    renderDashboard(root, sampleReport(), {
      onOpenFile,
      onNewAnalysis: vi.fn(),
      onExport: vi.fn(),
      onOpenSettings: vi.fn(),
    });

    root.querySelector<HTMLElement>(".file-card")?.click();
    expect(onOpenFile).toHaveBeenCalledWith("src/a.ts");
  });
});

describe("detail view", () => {
  it("locates and highlights a function in the source", () => {
    const report = sampleReport();
    const file = report.files[0];
    expect(file).toBeDefined();
    if (!file) return;

    const root = document.createElement("div");
    renderDetail(root, file, SOURCE, { onBack: vi.fn() });

    expect(root.querySelectorAll(".source__line").length).toBeGreaterThan(0);

    const links = root.querySelectorAll<HTMLElement>(".link");
    expect(links.length).toBeGreaterThan(0);
    links[0]?.click();

    expect(root.querySelectorAll(".source__line--active").length).toBeGreaterThan(0);
  });

  it("goes back from the header button", () => {
    const report = sampleReport();
    const file = report.files[0];
    if (!file) return;
    const onBack = vi.fn();
    const root = document.createElement("div");
    renderDetail(root, file, SOURCE, { onBack });

    root.querySelector<HTMLButtonElement>("button.button")?.click();
    expect(onBack).toHaveBeenCalled();
  });
});

describe("settings modal", () => {
  it("applies edited thresholds", () => {
    const onApply = vi.fn();
    openSettings({ ...DEFAULT_THRESHOLDS }, onApply);

    const overlay = document.querySelector<HTMLElement>(".modal-overlay");
    expect(overlay).not.toBeNull();
    const input = overlay?.querySelector<HTMLInputElement>("input");
    expect(input).not.toBeNull();
    if (input) input.value = "42";

    const apply = [...(overlay?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(
      (node) => node.textContent === "Apply",
    );
    apply?.click();

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]?.[0]?.cyclomatic).toBe(42);
    overlay?.remove();
  });
});
