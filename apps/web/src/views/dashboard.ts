import type { AnalysisReport, FunctionKind, FunctionReport } from "@meowanalyze/core";
import {
  bucketize,
  complexityColor,
  maintainabilityColor,
  PALETTE,
  type BucketRange,
  type DonutSegment,
} from "../charts.js";
import { pieChart } from "../pie.js";
import { button, countUp, el, type ViewTargets } from "../dom.js";
import { t } from "../i18n.js";

export interface DashboardHandlers {
  onOpenFile: (path: string) => void;
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

const NESTING_BUCKETS: readonly BucketRange[] = [
  { upTo: 0, label: "0", color: "#3fb950" },
  { upTo: 2, label: "1–2", color: "#d29922" },
  { upTo: 4, label: "3–4", color: "#f0883e" },
  { upTo: Number.POSITIVE_INFINITY, label: "5+", color: "#f85149" },
];

const LENGTH_BUCKETS: readonly BucketRange[] = [
  { upTo: 10, label: "1–10", color: "#3fb950" },
  { upTo: 30, label: "11–30", color: "#d29922" },
  { upTo: 80, label: "31–80", color: "#f0883e" },
  { upTo: Number.POSITIVE_INFINITY, label: "80+", color: "#f85149" },
];

const MAINTAINABILITY_BUCKETS: readonly BucketRange[] = [
  { upTo: 40, label: "<40", color: "#f85149" },
  { upTo: 65, label: "40–65", color: "#d29922" },
  { upTo: Number.POSITIVE_INFINITY, label: "65+", color: "#3fb950" },
];

const PARAM_BUCKETS: readonly BucketRange[] = [
  { upTo: 0, label: "0", color: "#3fb950" },
  { upTo: 2, label: "1–2", color: "#3fb950" },
  { upTo: 4, label: "3–4", color: "#d29922" },
  { upTo: Number.POSITIVE_INFINITY, label: "5+", color: "#f85149" },
];

const VOLUME_BUCKETS: readonly BucketRange[] = [
  { upTo: 50, label: "0–50", color: "#3fb950" },
  { upTo: 150, label: "51–150", color: "#d29922" },
  { upTo: 400, label: "151–400", color: "#f0883e" },
  { upTo: Number.POSITIVE_INFINITY, label: "400+", color: "#f85149" },
];

const FILE_SIZE_BUCKETS: readonly BucketRange[] = [
  { upTo: 100, label: "1–100", color: "#3fb950" },
  { upTo: 300, label: "101–300", color: "#d29922" },
  { upTo: 600, label: "301–600", color: "#f0883e" },
  { upTo: Number.POSITIVE_INFINITY, label: "600+", color: "#f85149" },
];

const KIND_ORDER: readonly FunctionKind[] = [
  "function",
  "method",
  "arrow",
  "constructor",
  "getter",
  "setter",
];

export function renderDashboard(
  targets: ViewTargets,
  report: AnalysisReport,
  handlers: DashboardHandlers,
): void {
  targets.head.replaceChildren(header(report, handlers));

  const pending: Array<() => void> = [];
  const body = el("div", { class: "dashboard-body" }, stats(report), donuts(report, pending));
  targets.body.replaceChildren(body);

  // Charts need their containers to be laid out first.
  const run = (): void => {
    for (const init of pending) init();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else run();
}

function header(report: AnalysisReport, handlers: DashboardHandlers): HTMLElement {
  const s = t();

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
    ),
    el(
      "div",
      { class: "page__actions" },
      button(s.common.settings, handlers.onOpenSettings),
      button(s.common.exportJson, handlers.onExport),
    ),
  );
}

function stats(report: AnalysisReport): HTMLElement {
  const { summary } = report;
  const s = t().dashboard.kpi;
  const commentTotal = summary.loc.code + summary.loc.comment;
  const density = commentTotal > 0 ? (summary.loc.comment / commentTotal) * 100 : 0;
  const markerCount = summary.markers.todo + summary.markers.fixme + summary.markers.hack;

  return el(
    "div",
    { class: "stats-grid" },
    miKpi(summary.maintainability),
    kpi(s.files, summary.files),
    kpi(s.functions, summary.metrics.cyclomatic.count),
    kpi(s.codeLines, summary.loc.code),
    kpi(s.commentPct, round1(density)),
    kpi(s.avgCyclomatic, round1(summary.metrics.cyclomatic.mean)),
    kpi(s.maxCyclomatic, summary.metrics.cyclomatic.max, complexityColor(summary.metrics.cyclomatic.max)),
    kpi(s.avgCognitive, round1(summary.metrics.cognitive.mean)),
    kpi(s.maxCognitive, summary.metrics.cognitive.max, complexityColor(summary.metrics.cognitive.max)),
    kpi(s.maxNesting, summary.metrics.nesting.max),
    kpi(s.avgFunctionLength, round1(summary.metrics.functionLoc.mean)),
    kpi(s.halsteadDifficulty, round1(summary.metrics.halsteadDifficulty.mean)),
    kpi(s.physicalLines, summary.loc.physical),
    kpi(s.logicalLines, summary.loc.logical),
    kpi(s.violations, summary.violations.total, summary.violations.total > 0 ? "#d29922" : undefined),
    kpi(s.markers, markerCount, markerCount > 0 ? "#d29922" : undefined),
  );
}

function miKpi(value: number): HTMLElement {
  const valueNode = el("div", { class: "kpi__value", text: String(Math.round(value)) });
  valueNode.style.color = maintainabilityColor(value);
  return el(
    "div",
    { class: "kpi" },
    valueNode,
    el("div", { class: "kpi__label", text: `${t().dashboard.kpi.maintainability} · ${maintainabilityLabel(value)}` }),
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

function donuts(
  report: AnalysisReport,
  pending: Array<() => void>,
): HTMLElement {
  const s = t().dashboard;
  const functions = allFunctions(report).map((entry) => entry.fn);

  const card = (
    title: string,
    segments: DonutSegment[],
    centerValue: string,
    centerLabel: string,
  ): HTMLElement => {
    const host = el("div", { class: "chart-host" });
    pending.push(() => pieChart(host, { segments, centerValue, centerLabel }));
    return el("div", { class: "donut-card" }, el("h3", { text: title }), host);
  };

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

  const cards: HTMLElement[] = [
    card(s.charts.linesOfCode, loc, String(report.summary.loc.physical), s.donut.physical),
    card(s.charts.languages, languages, String(report.summary.files), s.donut.files),
    card(s.charts.cyclomatic, bucketize(functions.map((f) => f.cyclomatic), CYCLOMATIC_BUCKETS), String(functions.length), s.donut.functions),
    card(s.charts.cognitive, bucketize(functions.map((f) => f.cognitive), COGNITIVE_BUCKETS), String(functions.length), s.donut.functions),
    card(s.charts.nesting, bucketize(functions.map((f) => f.maxNesting), NESTING_BUCKETS), String(functions.length), s.donut.functions),
    card(s.charts.functionLength, bucketize(functions.map((f) => f.loc), LENGTH_BUCKETS), String(functions.length), s.donut.functions),
    card(s.charts.functionKinds, functionKinds(functions), String(functions.length), s.donut.functions),
    card(s.charts.maintainability, bucketize(functions.map((f) => f.maintainability), MAINTAINABILITY_BUCKETS), String(functions.length), s.donut.functions),
    card(s.charts.parameters, bucketize(functions.map((f) => f.params), PARAM_BUCKETS), String(functions.length), s.donut.functions),
    card(s.charts.halsteadVolume, bucketize(functions.map((f) => f.halstead.volume), VOLUME_BUCKETS), String(functions.length), s.donut.functions),
    card(s.charts.fileSize, bucketize(report.files.map((f) => f.loc.code), FILE_SIZE_BUCKETS), String(report.files.length), s.donut.files),
  ];

  const markers = markerSegments(report);
  if (markers.length > 0) {
    cards.push(
      card(s.charts.markers, markers, String(report.summary.markers.todo + report.summary.markers.fixme + report.summary.markers.hack), s.charts.markers),
    );
  }

  const rules = violationsByRule(report);
  if (rules.length > 0) {
    cards.push(card(s.charts.ruleViolations, rules, String(report.summary.violations.total), s.charts.ruleViolations));
  }

  return el("div", { class: "donut-row" }, ...cards);
}

function functionKinds(functions: readonly FunctionReport[]): DonutSegment[] {
  const counts = new Map<FunctionKind, number>();
  for (const fn of functions) counts.set(fn.kind, (counts.get(fn.kind) ?? 0) + 1);
  return KIND_ORDER.filter((kind) => (counts.get(kind) ?? 0) > 0).map((kind, index) => ({
    label: t().dashboard.kinds[kind],
    value: counts.get(kind) ?? 0,
    color: PALETTE[index % PALETTE.length] ?? "#58a6ff",
  }));
}

function markerSegments(report: AnalysisReport): DonutSegment[] {
  const { markers } = report.summary;
  return [
    { label: "TODO", value: markers.todo, color: "#f85149" },
    { label: "FIXME", value: markers.fixme, color: "#d29922" },
    { label: "HACK", value: markers.hack, color: "#bc8cff" },
  ].filter((segment) => segment.value > 0);
}

function violationsByRule(report: AnalysisReport): DonutSegment[] {
  const counts = new Map<string, number>();
  for (const file of report.files) {
    for (const violation of file.violations) {
      counts.set(violation.rule, (counts.get(violation.rule) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([rule, count], index) => ({
      label: rule,
      value: count,
      color: PALETTE[index % PALETTE.length] ?? "#d29922",
    }));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
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
