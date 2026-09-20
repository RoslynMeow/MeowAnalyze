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
import { t } from "../i18n.js";

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
  const s = t();
  const markerCount = summary.markers.todo + summary.markers.fixme + summary.markers.hack;

  return el(
    "header",
    { class: "hero-panel" },
    el(
      "div",
      { class: "hero-panel__main" },
      el("h1", { class: "hero-panel__title", text: s.dashboard.title }),
      el("p", {
        class: "hero-panel__meta",
        text: `${report.root} · ${report.durationMs}ms · v${report.toolVersion}`,
      }),
      el(
        "div",
        { class: "hero-panel__badges" },
        el("span", { class: "pill", text: s.dashboard.pills.files(summary.files) }),
        el("span", {
          class: "pill",
          text: s.dashboard.pills.functions(summary.metrics.cyclomatic.count),
        }),
        el("span", {
          class: "pill",
          text: s.dashboard.pills.violations(summary.violations.total),
        }),
        markerCount > 0
          ? el("span", {
              class: "pill warn",
              text: s.dashboard.pills.markers(
                summary.markers.todo,
                summary.markers.fixme,
                summary.markers.hack,
              ),
            })
          : null,
      ),
      el(
        "div",
        { class: "hero-panel__actions" },
        button(s.common.settings, handlers.onOpenSettings),
        button(s.common.exportJson, handlers.onExport),
        button(s.common.newAnalysis, handlers.onNewAnalysis),
      ),
    ),
    el(
      "div",
      { class: "hero-panel__gauge" },
      gaugeChart(mi, { label: "MI" }),
      el("p", { class: "hero-panel__gauge-caption", text: maintainabilityLabel(mi) }),
    ),
  );
}

function maintainabilityLabel(value: number): string {
  const s = t().dashboard.maintainability;
  if (value < 40) return s.low;
  if (value < 65) return s.moderate;
  return s.healthy;
}

function kpis(report: AnalysisReport): HTMLElement {
  const { summary } = report;
  const s = t().dashboard.kpi;
  const commentTotal = summary.loc.code + summary.loc.comment;
  const density = commentTotal > 0 ? (summary.loc.comment / commentTotal) * 100 : 0;
  const markerCount = summary.markers.todo + summary.markers.fixme + summary.markers.hack;

  return el(
    "div",
    { class: "kpis" },
    kpi(s.files, summary.files),
    kpi(s.functions, summary.metrics.cyclomatic.count),
    kpi(s.codeLines, summary.loc.code),
    kpi(s.commentPct, Number(density.toFixed(1))),
    kpi(s.maxCyclomatic, summary.metrics.cyclomatic.max, complexityColor(summary.metrics.cyclomatic.max)),
    kpi(s.maxCognitive, summary.metrics.cognitive.max, complexityColor(summary.metrics.cognitive.max)),
    kpi(s.violations, summary.violations.total, summary.violations.total > 0 ? "#d29922" : undefined),
    kpi(s.markers, markerCount, markerCount > 0 ? "#d29922" : undefined),
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
    { label: t().dashboard.segment.code, value: report.summary.loc.code, color: "#58a6ff" },
    { label: t().dashboard.segment.comment, value: report.summary.loc.comment, color: "#3fb950" },
    { label: t().dashboard.segment.blank, value: report.summary.loc.blank, color: "#8b949e" },
  ];

  const languageSegments: DonutSegment[] = Object.entries(report.summary.filesByLanguage)
    .sort((a, b) => b[1] - a[1])
    .map(([language, count], index) => ({
      label: language,
      value: count,
      color: PALETTE[index % PALETTE.length] ?? "#58a6ff",
    }));

  const s = t().dashboard.charts;
  const blocks: HTMLElement[] = [
    chartBlock(s.cyclomatic, histogramChart(cyclomatic), true),
    chartBlock(s.cognitive, histogramChart(cognitive), true),
    chartBlock(s.topFunctions, clickableBar(topFunctions, handlers)),
    chartBlock(
      s.linesOfCode,
      donutWithLegend(locDonut, String(report.summary.loc.physical), t().dashboard.donut.physical),
    ),
    chartBlock(
      s.languages,
      donutWithLegend(languageSegments, String(report.summary.files), t().dashboard.donut.files),
    ),
    chartBlock(s.filesTreemap, clickableTreemap(filesTreemap, handlers), true),
  ];

  const ruleCounts = violationsByRule(report);
  if (ruleCounts.length > 0) {
    blocks.push(
      chartBlock(
        s.ruleViolations,
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
    const fc = t().dashboard.fileCard;
    const node = el(
      "button",
      { class: "file-card", onClick: () => handlers.onOpenFile(file.path) },
      el("div", { class: "file-card__path", text: file.path }),
      el(
        "div",
        { class: "file-card__stats" },
        el("span", { class: "file-card__cyclo", text: fc.cyclo(file.metrics.cyclomatic.max) }),
        el("span", { text: fc.cognitive(file.metrics.cognitive.max) }),
        el("span", { text: fc.code(file.loc.code) }),
        el("span", { text: fc.functions(file.functions.length) }),
        el("span", { class: "file-card__mi", text: fc.maintainability(Number(file.maintainability.toFixed(0))) }),
      ),
    );
    node.style.setProperty("--delay", `${index * 18}ms`);
    list.append(node);
  });
  return card(t().dashboard.filesTitle(report.files.length), list);
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
