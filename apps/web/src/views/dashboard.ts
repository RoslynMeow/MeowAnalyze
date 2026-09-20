import type { AnalysisReport, FunctionReport } from "@meowanalyze/core";
import {
  bucketize,
  complexityColor,
  donutChart,
  gaugeChart,
  PALETTE,
  type BucketRange,
  type DonutSegment,
} from "../charts.js";
import { button, countUp, el } from "../dom.js";
import { t } from "../i18n.js";
import { dataTable, type Cell } from "../table.js";

export interface DashboardHandlers {
  onOpenFile: (path: string) => void;
  onNewAnalysis: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
}

const CYCLOMATIC_BUCKETS: readonly BucketRange[] = [
  { upTo: 5, label: "1–5", color: "#3fb950" },
  { upTo: 10, label: "6–10", color: "#d29922" },
  { upTo: 20, label: "11–20", color: "#f0883e" },
  { upTo: Number.POSITIVE_INFINITY, label: "21+", color: "#f85149" },
];

const COGNITIVE_BUCKETS: readonly BucketRange[] = [
  { upTo: 5, label: "0–5", color: "#3fb950" },
  { upTo: 15, label: "6–15", color: "#d29922" },
  { upTo: 30, label: "16–30", color: "#f0883e" },
  { upTo: Number.POSITIVE_INFINITY, label: "31+", color: "#f85149" },
];

export function renderDashboard(
  root: HTMLElement,
  report: AnalysisReport,
  handlers: DashboardHandlers,
): void {
  root.replaceChildren();
  root.append(header(report, handlers), summaryRow(report), donutRow(report), topFunctions(report, handlers));
}

function header(report: AnalysisReport, handlers: DashboardHandlers): HTMLElement {
  const s = t();
  const { summary } = report;
  const markers = summary.markers.todo + summary.markers.fixme + summary.markers.hack;

  return el(
    "header",
    { class: "page__head" },
    el(
      "div",
      {},
      el("h1", { class: "page__title", text: s.pages.dashboard }),
      el("p", {
        class: "page__meta",
        text: `${report.root} · ${report.durationMs}ms · v${report.toolVersion}`,
      }),
      el(
        "div",
        { class: "page__pills" },
        el("span", { class: "pill", text: s.dashboard.pills.files(summary.files) }),
        el("span", { class: "pill", text: s.dashboard.pills.functions(summary.metrics.cyclomatic.count) }),
        el("span", { class: "pill", text: s.dashboard.pills.violations(summary.violations.total) }),
        markers > 0
          ? el("span", {
              class: "pill warn",
              text: s.dashboard.pills.markers(summary.markers.todo, summary.markers.fixme, summary.markers.hack),
            })
          : null,
      ),
    ),
    el(
      "div",
      { class: "page__actions" },
      button(s.common.settings, handlers.onOpenSettings),
      button(s.common.exportJson, handlers.onExport),
      button(s.common.newAnalysis, handlers.onNewAnalysis),
    ),
  );
}

function summaryRow(report: AnalysisReport): HTMLElement {
  const { summary } = report;
  const s = t().dashboard.kpi;
  const commentTotal = summary.loc.code + summary.loc.comment;
  const density = commentTotal > 0 ? (summary.loc.comment / commentTotal) * 100 : 0;

  return el(
    "div",
    { class: "summary-row" },
    el(
      "div",
      { class: "summary-gauge" },
      gaugeChart(summary.maintainability, { size: 170, label: "MI" }),
      el("p", { class: "summary-gauge__caption", text: maintainabilityLabel(summary.maintainability) }),
    ),
    el(
      "div",
      { class: "kpis" },
      kpi(s.files, summary.files),
      kpi(s.functions, summary.metrics.cyclomatic.count),
      kpi(s.codeLines, summary.loc.code),
      kpi(s.commentPct, Number(density.toFixed(1))),
      kpi(s.maxCyclomatic, summary.metrics.cyclomatic.max, complexityColor(summary.metrics.cyclomatic.max)),
      kpi(s.maxCognitive, summary.metrics.cognitive.max, complexityColor(summary.metrics.cognitive.max)),
    ),
  );
}

function maintainabilityLabel(value: number): string {
  const s = t().dashboard.maintainability;
  if (value < 40) return s.low;
  if (value < 65) return s.moderate;
  return s.healthy;
}

function kpi(label: string, value: number, color?: string): HTMLElement {
  const valueNode = el("div", { class: "kpi__value" });
  if (color) valueNode.style.color = color;
  if (Number.isInteger(value)) countUp(valueNode, value);
  else valueNode.textContent = String(value);
  return el("div", { class: "kpi" }, valueNode, el("div", { class: "kpi__label", text: label }));
}

function donutRow(report: AnalysisReport): HTMLElement {
  const s = t().dashboard;
  const functions = allFunctions(report).map((entry) => entry.fn);

  const loc: DonutSegment[] = [
    { label: s.segment.code, value: report.summary.loc.code, color: "#58a6ff" },
    { label: s.segment.comment, value: report.summary.loc.comment, color: "#3fb950" },
    { label: s.segment.blank, value: report.summary.loc.blank, color: "#8b949e" },
  ];

  const languages: DonutSegment[] = Object.entries(report.summary.filesByLanguage)
    .sort((a, b) => b[1] - a[1])
    .map(([language, count], index) => ({
      label: language,
      value: count,
      color: PALETTE[index % PALETTE.length] ?? "#58a6ff",
    }));

  return el(
    "div",
    { class: "donut-row" },
    donutCard(s.charts.linesOfCode, loc, String(report.summary.loc.physical), s.donut.physical),
    donutCard(s.charts.languages, languages, String(report.summary.files), s.donut.files),
    donutCard(
      s.charts.cyclomatic,
      bucketize(functions.map((fn) => fn.cyclomatic), CYCLOMATIC_BUCKETS),
      String(functions.length),
      s.donut.functions,
    ),
    donutCard(
      s.charts.cognitive,
      bucketize(functions.map((fn) => fn.cognitive), COGNITIVE_BUCKETS),
      String(functions.length),
      s.donut.functions,
    ),
  );
}

function donutCard(
  title: string,
  segments: DonutSegment[],
  centerValue: string,
  centerLabel: string,
): HTMLElement {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return el(
    "div",
    { class: "donut-card" },
    el("h3", { text: title }),
    donutChart(segments, { centerValue, centerLabel, size: 170 }),
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

function topFunctions(report: AnalysisReport, handlers: DashboardHandlers): HTMLElement {
  const s = t().dashboard;
  const top = allFunctions(report)
    .sort((a, b) => b.fn.cognitive - a.fn.cognitive || b.fn.cyclomatic - a.fn.cyclomatic)
    .slice(0, 8);

  const rows: Cell[][] = top.map(({ file, fn }) => [
    {
      content: el("span", {
        class: "link",
        text: fn.name,
        onClick: () => handlers.onOpenFile(file),
      }),
    },
    { content: file },
    {
      content: el("span", { class: complexityClass(fn.cyclomatic), text: String(fn.cyclomatic) }),
      value: fn.cyclomatic,
    },
    {
      content: el("span", { class: complexityClass(fn.cognitive), text: String(fn.cognitive) }),
      value: fn.cognitive,
    },
  ]);

  return el(
    "div",
    { class: "top-functions" },
    el("h3", { text: s.topFunctions }),
    dataTable(
      [
        { header: s.topTable.function },
        { header: s.topTable.file },
        { header: s.topTable.cyclomatic, align: "right" },
        { header: s.topTable.cognitive, align: "right" },
      ],
      rows,
    ),
  );
}

function complexityClass(value: number): string {
  if (value >= 20) return "bad";
  if (value >= 10) return "warn";
  return "";
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
