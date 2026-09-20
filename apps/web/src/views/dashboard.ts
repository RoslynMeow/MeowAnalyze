import type { AnalysisReport, FunctionReport } from "@meowanalyze/core";
import {
  barList,
  complexityColor,
  donutChart,
  gaugeChart,
  histogramChart,
  maintainabilityColor,
  PALETTE,
  treemapChart,
  type DonutSegment,
} from "../charts.js";
import { button, card, countUp, el } from "../dom.js";

export interface DashboardHandlers {
  onOpenFile: (path: string) => void;
  onNewAnalysis: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
}

export function renderDashboard(
  root: HTMLElement,
  report: AnalysisReport,
  handlers: DashboardHandlers,
): void {
  root.replaceChildren();

  root.append(
    el(
      "div",
      { class: "view dashboard" },
      hero(report, handlers),
      kpis(report),
      charts(report, handlers),
      filesStrip(report, handlers),
    ),
  );
}

function hero(report: AnalysisReport, handlers: DashboardHandlers): HTMLElement {
  const { summary } = report;
  const mi = summary.maintainability;

  return el(
    "header",
    { class: "hero-panel" },
    el(
      "div",
      { class: "hero-panel__main" },
      el("h1", { class: "hero-panel__title", text: "Analysis dashboard" }),
      el("p", {
        class: "hero-panel__meta",
        text: `${report.root} · ${report.durationMs}ms · v${report.toolVersion}`,
      }),
      el(
        "div",
        { class: "hero-panel__badges" },
        el("span", { class: "pill", text: `${summary.files} files` }),
        el("span", { class: "pill", text: `${summary.metrics.cyclomatic.count} functions` }),
        el("span", {
          class: "pill",
          text: `${summary.violations.total} violations`,
        }),
        summary.markers.todo + summary.markers.fixme + summary.markers.hack > 0
          ? el("span", {
              class: "pill warn",
              text: `TODO ${summary.markers.todo} · FIXME ${summary.markers.fixme} · HACK ${summary.markers.hack}`,
            })
          : null,
      ),
      el(
        "div",
        { class: "hero-panel__actions" },
        button("Settings", handlers.onOpenSettings),
        button("Export JSON", handlers.onExport),
        button("New analysis", handlers.onNewAnalysis),
      ),
    ),
    el(
      "div",
      { class: "hero-panel__gauge" },
      gaugeChart(mi, { label: "maintainability" }),
      el("p", { class: "hero-panel__gauge-caption", text: maintainabilityLabel(mi) }),
    ),
  );
}

function maintainabilityLabel(value: number): string {
  if (value < 40) return "hard to maintain";
  if (value < 65) return "moderate";
  return "healthy";
}

function kpis(report: AnalysisReport): HTMLElement {
  const { summary } = report;
  const commentTotal = summary.loc.code + summary.loc.comment;
  const density =
    commentTotal > 0 ? (summary.loc.comment / commentTotal) * 100 : 0;

  return el(
    "div",
    { class: "kpis" },
    kpi("Files", summary.files),
    kpi("Functions", summary.metrics.cyclomatic.count),
    kpi("Code lines", summary.loc.code),
    kpi("Comment %", Number(density.toFixed(1))),
    kpi("Max cyclomatic", summary.metrics.cyclomatic.max, complexityColor(summary.metrics.cyclomatic.max)),
    kpi("Max cognitive", summary.metrics.cognitive.max, complexityColor(summary.metrics.cognitive.max)),
    kpi(
      "Violations",
      summary.violations.total,
      summary.violations.total > 0 ? "#d29922" : undefined,
    ),
    kpi(
      "Markers",
      summary.markers.todo + summary.markers.fixme + summary.markers.hack,
      summary.markers.todo + summary.markers.fixme + summary.markers.hack > 0
        ? "#d29922"
        : undefined,
    ),
  );
}

function kpi(label: string, value: number, color?: string): HTMLElement {
  const valueNode = el("div", { class: "kpi__value" });
  if (color) valueNode.style.color = color;
  if (Number.isInteger(value)) countUp(valueNode, value);
  else valueNode.textContent = String(value);
  return el("div", { class: "kpi" }, valueNode, el("div", { class: "kpi__label", text: label }));
}

function charts(report: AnalysisReport, handlers: DashboardHandlers): HTMLElement {
  const functions = allFunctions(report);
  const cyclomatic = functions.map((entry) => entry.fn.cyclomatic);
  const cognitive = functions.map((entry) => entry.fn.cognitive);

  const topFunctions = [...functions]
    .sort((a, b) => b.fn.cognitive - a.fn.cognitive || b.fn.cyclomatic - a.fn.cyclomatic)
    .slice(0, 12)
    .map((entry) => ({
      label: `${entry.fn.name} · ${entry.file}`,
      value: entry.fn.cognitive,
      sub: `cyclo ${entry.fn.cyclomatic}, nest ${entry.fn.maxNesting}`,
      color: complexityColor(entry.fn.cognitive),
      key: entry.file,
    }));

  const filesTreemap = report.files
    .filter((file) => file.loc.code > 0)
    .map((file) => ({
      label: file.path,
      value: file.loc.code,
      color: complexityColor(file.metrics.cognitive.max),
      key: file.path,
    }));

  const locDonut: DonutSegment[] = [
    { label: "code", value: report.summary.loc.code, color: "#58a6ff" },
    { label: "comment", value: report.summary.loc.comment, color: "#3fb950" },
    { label: "blank", value: report.summary.loc.blank, color: "#8b949e" },
  ];

  const languageSegments: DonutSegment[] = Object.entries(report.summary.filesByLanguage)
    .sort((a, b) => b[1] - a[1])
    .map(([language, count], index) => ({
      label: language,
      value: count,
      color: PALETTE[index % PALETTE.length] ?? "#58a6ff",
    }));

  const blocks: HTMLElement[] = [
    chartBlock("Cyclomatic complexity distribution", histogramChart(cyclomatic), true),
    chartBlock("Cognitive complexity distribution", histogramChart(cognitive), true),
    chartBlock("Most complex functions — click to drill down", clickableBar(topFunctions, handlers)),
    chartBlock("Lines of code", donutWithLegend(locDonut, String(report.summary.loc.physical), "physical")),
    chartBlock("Languages", donutWithLegend(languageSegments, String(report.summary.files), "files")),
    chartBlock(
      "Files by code lines — color = max cognitive, click to drill down",
      clickableTreemap(filesTreemap, handlers),
      true,
    ),
  ];

  const ruleCounts = violationsByRule(report);
  if (ruleCounts.length > 0) {
    blocks.push(
      chartBlock(
        "Rule violations",
        barList(
          ruleCounts.map(([rule, count], index) => ({
            label: rule,
            value: count,
            color: PALETTE[index % PALETTE.length] ?? "#d29922",
          })),
        ),
        true,
      ),
    );
  }

  return el("div", { class: "charts" }, ...blocks);
}

function chartBlock(title: string, chart: Node, wide = false): HTMLElement {
  const block = el(
    "div",
    { class: wide ? "chart-block chart-block--wide" : "chart-block" },
    el("h3", { text: title }),
    chart,
  );
  block.classList.add("reveal");
  return block;
}

function clickableBar(
  items: Parameters<typeof barList>[0],
  handlers: DashboardHandlers,
): SVGSVGElement {
  const chart = barList(items);
  chart.addEventListener("click", (event) => {
    const key = (event.target as SVGElement).closest("[data-key]")?.getAttribute("data-key");
    if (key) handlers.onOpenFile(key);
  });
  return chart;
}

function clickableTreemap(
  items: Parameters<typeof treemapChart>[0],
  handlers: DashboardHandlers,
): SVGSVGElement {
  const chart = treemapChart(items);
  chart.addEventListener("click", (event) => {
    const key = (event.target as SVGElement).closest("[data-key]")?.getAttribute("data-key");
    if (key) handlers.onOpenFile(key);
  });
  return chart;
}

function filesStrip(report: AnalysisReport, handlers: DashboardHandlers): HTMLElement {
  const list = el("div", { class: "file-cards" });
  const sorted = [...report.files].sort(
    (a, b) => b.metrics.cognitive.max - a.metrics.cognitive.max,
  );
  sorted.forEach((file, index) => {
    const node = el(
      "button",
      { class: "file-card", onClick: () => handlers.onOpenFile(file.path) },
      el("div", { class: "file-card__path", text: file.path }),
      el(
        "div",
        { class: "file-card__stats" },
        el("span", { class: "file-card__cyclo", text: `cyclo ${file.metrics.cyclomatic.max}` }),
        el("span", { text: `cog ${file.metrics.cognitive.max}` }),
        el("span", { text: `${file.loc.code} code` }),
        el("span", { text: `${file.functions.length} fns` }),
        el("span", {
          class: "file-card__mi",
          text: `MI ${file.maintainability.toFixed(0)}`,
        }),
      ),
    );
    node.style.setProperty("--delay", `${index * 18}ms`);
    list.append(node);
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

function violationsByRule(report: AnalysisReport): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const file of report.files) {
    for (const violation of file.violations) {
      counts.set(violation.rule, (counts.get(violation.rule) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
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
