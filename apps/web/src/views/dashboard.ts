import type { AnalysisReport, FunctionReport, Thresholds } from "@meowanalyze/core";
import {
  barList,
  complexityColor,
  donutChart,
  histogramChart,
  PALETTE,
  treemapChart,
  type DonutSegment,
} from "../charts.js";
import { button, card, countUp, el } from "../dom.js";

export interface DashboardHandlers {
  thresholds: Thresholds;
  onOpenFile: (path: string) => void;
  onNewAnalysis: () => void;
  onExport: () => void;
  onThresholdsChange: (thresholds: Thresholds) => void;
}

export function renderDashboard(
  root: HTMLElement,
  report: AnalysisReport,
  handlers: DashboardHandlers,
): void {
  root.replaceChildren();

  const view = el(
    "div",
    { class: "view dashboard" },
    header(report, handlers),
    kpis(report),
    charts(report, handlers),
    filesStrip(report, handlers),
  );

  root.append(view);
}

function header(report: AnalysisReport, handlers: DashboardHandlers): HTMLElement {
  const controls = el(
    "div",
    { class: "dashboard__controls" },
    el(
      "details",
      { class: "config" },
      el("summary", { text: "Thresholds" }),
      thresholdsPanel(handlers),
    ),
    button("Export JSON", handlers.onExport),
    button("New analysis", handlers.onNewAnalysis),
  );

  return el(
    "header",
    { class: "dashboard__header" },
    el(
      "div",
      {},
      el("h1", { class: "dashboard__title", text: "Analysis dashboard" }),
      el("p", {
        class: "dashboard__meta",
        text: `${report.root} · ${report.durationMs}ms · v${report.toolVersion}`,
      }),
    ),
    controls,
  );
}

function thresholdsPanel(handlers: DashboardHandlers): HTMLElement {
  const fields: Array<[keyof Thresholds, string]> = [
    ["cyclomatic", "cyclomatic"],
    ["nesting", "nesting"],
    ["params", "params"],
    ["functionLoc", "function loc"],
    ["fileLoc", "file loc"],
  ];
  const inputs = new Map<keyof Thresholds, HTMLInputElement>();

  const panel = el("div", { class: "thresholds" });
  for (const [key, label] of fields) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = String(handlers.thresholds[key]);
    inputs.set(key, input);
    panel.append(
      el("label", { class: "threshold" }, el("span", { text: label }), input),
    );
  }
  panel.append(
    button("Re-analyze", () => {
      const next = { ...handlers.thresholds };
      for (const [key, input] of inputs) {
        const value = Number.parseInt(input.value, 10);
        if (Number.isFinite(value) && value >= 0) next[key] = value;
      }
      handlers.onThresholdsChange(next);
    }),
  );
  return panel;
}

function kpis(report: AnalysisReport): HTMLElement {
  const { summary } = report;
  const maxCyclo = summary.metrics.cyclomatic.max;
  const grid = el(
    "div",
    { class: "kpis" },
    kpi("Files", summary.files),
    kpi("Functions", summary.metrics.cyclomatic.count),
    kpi("Code lines", summary.loc.code),
    kpi("Max complexity", maxCyclo, complexityColor(maxCyclo)),
    kpi("Mean complexity", Number(summary.metrics.cyclomatic.mean.toFixed(2))),
    kpi(
      "Violations",
      summary.violations.total,
      summary.violations.total > 0 ? "#d29922" : undefined,
    ),
  );
  return grid;
}

function kpi(label: string, value: number, color?: string): HTMLElement {
  const valueNode = el("div", { class: "kpi__value" });
  if (color) valueNode.style.color = color;
  if (Number.isInteger(value)) countUp(valueNode, value);
  else valueNode.textContent = String(value);
  return el(
    "div",
    { class: "kpi" },
    valueNode,
    el("div", { class: "kpi__label", text: label }),
  );
}

function charts(report: AnalysisReport, handlers: DashboardHandlers): HTMLElement {
  const functions = allFunctions(report);
  const cyclomatic = functions.map((entry) => entry.fn.cyclomatic);

  const topFunctions = [...functions]
    .sort((a, b) => b.fn.cyclomatic - a.fn.cyclomatic)
    .slice(0, 12)
    .map((entry) => ({
      label: `${entry.fn.name} · ${entry.file}`,
      value: entry.fn.cyclomatic,
      sub: `nest ${entry.fn.maxNesting}, ${entry.fn.loc} loc`,
      color: complexityColor(entry.fn.cyclomatic),
      key: entry.file,
    }));

  const filesTreemap = report.files
    .filter((file) => file.loc.code > 0)
    .map((file) => ({
      label: file.path,
      value: file.loc.code,
      color: complexityColor(file.metrics.cyclomatic.max),
      key: file.path,
    }));

  const locDonut: DonutSegment[] = [
    { label: "code", value: report.summary.loc.code, color: "#58a6ff" },
    { label: "comment", value: report.summary.loc.comment, color: "#3fb950" },
    { label: "blank", value: report.summary.loc.blank, color: "#8b949e" },
  ];

  const languageSegments: DonutSegment[] = Object.entries(
    report.summary.filesByLanguage,
  )
    .sort((a, b) => b[1] - a[1])
    .map(([language, count], index) => ({
      label: language,
      value: count,
      color: PALETTE[index % PALETTE.length] ?? "#58a6ff",
    }));

  const topBar = barList(topFunctions);
  topBar.addEventListener("click", (event) => {
    const key = (event.target as SVGElement).closest("[data-key]")?.getAttribute("data-key");
    if (key) handlers.onOpenFile(key);
  });

  const treemap = treemapChart(filesTreemap);
  treemap.addEventListener("click", (event) => {
    const key = (event.target as SVGElement).closest("[data-key]")?.getAttribute("data-key");
    if (key) handlers.onOpenFile(key);
  });

  return el(
    "div",
    { class: "charts" },
    el(
      "div",
      { class: "chart-block chart-block--wide" },
      el("h3", { text: "Cyclomatic complexity distribution" }),
      histogramChart(cyclomatic),
      el("p", {
        class: "chart-caption",
        text: "Functions per complexity score. Yellow at 10, red at 20.",
      }),
    ),
    el(
      "div",
      { class: "chart-block chart-block--wide" },
      el("h3", { text: "Most complex functions — click to drill down" }),
      topBar,
    ),
    el(
      "div",
      { class: "chart-block" },
      el("h3", { text: "Lines of code" }),
      donutWithLegend(locDonut, String(report.summary.loc.physical), "physical"),
    ),
    el(
      "div",
      { class: "chart-block" },
      el("h3", { text: "Languages" }),
      donutWithLegend(languageSegments, String(report.summary.files), "files"),
    ),
    el(
      "div",
      { class: "chart-block chart-block--wide" },
      el("h3", { text: "Files by code lines — color = max complexity, click to drill down" }),
      treemap,
    ),
  );
}

function filesStrip(
  report: AnalysisReport,
  handlers: DashboardHandlers,
): HTMLElement {
  const list = el("div", { class: "file-cards" });
  const sorted = [...report.files].sort(
    (a, b) => b.metrics.cyclomatic.max - a.metrics.cyclomatic.max,
  );
  sorted.forEach((file, index) => {
    const cardNode = el(
      "button",
      { class: "file-card", onClick: () => handlers.onOpenFile(file.path) },
      el("div", { class: "file-card__path", text: file.path }),
      el(
        "div",
        { class: "file-card__stats" },
        el("span", {
          class: "file-card__cyclo",
          text: `cyclo ${file.metrics.cyclomatic.max}`,
        }),
        el("span", { text: `${file.loc.code} code` }),
        el("span", { text: `${file.functions.length} fns` }),
      ),
    );
    cardNode.style.setProperty("--delay", `${index * 18}ms`);
    list.append(cardNode);
  });

  return card(`Files (${report.files.length})`, list);
}

function donutWithLegend(
  segments: DonutSegment[],
  centerValue: string,
  centerLabel: string,
): HTMLElement {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return el(
    "div",
    { class: "donut" },
    donutChart(segments, { centerValue, centerLabel }),
    el(
      "ul",
      { class: "legend" },
      ...segments.map((segment) => {
        const swatch = el("span", { class: "legend__swatch" });
        swatch.style.background = segment.color;
        return el(
          "li",
          {},
          swatch,
          `${segment.label} — ${segment.value}${
            total > 0 ? ` (${Math.round((segment.value / total) * 100)}%)` : ""
          }`,
        );
      }),
    ),
  );
}

function allFunctions(
  report: AnalysisReport,
): Array<{ file: string; fn: FunctionReport }> {
  const all: Array<{ file: string; fn: FunctionReport }> = [];
  for (const file of report.files) {
    for (const fn of file.functions) all.push({ file: file.path, fn });
  }
  return all;
}
