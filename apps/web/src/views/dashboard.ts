import type { AnalysisReport, FileReport, FunctionKind, FunctionReport } from "@meowanalyze/core";
import {
  bucketize,
  complexityColor,
  maintainabilityColor,
  PALETTE,
  type BucketRange,
  type DonutSegment,
} from "../charts.js";
import { countUp, el, type ViewTargets } from "../dom.js";
import { openDrilldown, type DrillItem } from "../drilldown.js";
import { renderBar, renderDonut } from "../echarts.js";
import { t } from "../i18n.js";

export interface DashboardHandlers {
  onJump: (item: DrillItem) => void;
}

interface Entry {
  file: string;
  fn: FunctionReport;
}

interface DrillSpec {
  title: string;
  chart: "donut" | "bar";
  segments: DonutSegment[];
  items: DrillItem[];
  ranges?: readonly BucketRange[];
  centerValue?: string;
  centerLabel?: string;
}

interface KpiEntry {
  label: string;
  value: number;
  color?: string;
  spec: DrillSpec;
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

const DIFFICULTY_BUCKETS: readonly BucketRange[] = [
  { upTo: 5, label: "0–5", color: "#3fb950" },
  { upTo: 15, label: "6–15", color: "#d29922" },
  { upTo: 30, label: "16–30", color: "#f0883e" },
  { upTo: Number.POSITIVE_INFINITY, label: "30+", color: "#f85149" },
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
  targets.head.replaceChildren(header());

  const entries = allFunctions(report);
  const functions = entries.map((entry) => entry.fn);
  const files = report.files;
  const s = t().dashboard;

  const valueOf = {
    cyclomatic: (fn: FunctionReport) => fn.cyclomatic,
    cognitive: (fn: FunctionReport) => fn.cognitive,
    nesting: (fn: FunctionReport) => fn.maxNesting,
    loc: (fn: FunctionReport) => fn.loc,
    params: (fn: FunctionReport) => fn.params,
    maintainability: (fn: FunctionReport) => fn.maintainability,
    volume: (fn: FunctionReport) => fn.halstead.volume,
    difficulty: (fn: FunctionReport) => fn.halstead.difficulty,
  };

  const functionItems = (
    selector: (fn: FunctionReport) => number,
  ): DrillItem[] =>
    entries.map((entry) => ({
      label: entry.fn.name,
      file: entry.file,
      line: entry.fn.range.start.line,
      endLine: entry.fn.range.end.line,
      value: selector(entry.fn),
      category: entry.fn.kind,
    }));

  const fileItems = (selector: (file: FileReport) => number): DrillItem[] =>
    files.map((file) => ({
      label: file.path,
      file: file.path,
      value: selector(file),
      category: file.language,
    }));

  const bucketSpec = (
    title: string,
    values: number[],
    ranges: readonly BucketRange[],
    items: DrillItem[],
    centerValue: string,
    centerLabel: string,
  ): DrillSpec => ({
    title,
    chart: "bar",
    segments: bucketize(values, ranges),
    ranges,
    items,
    centerValue,
    centerLabel,
  });

  const cyclomaticSpec = bucketSpec(
    s.charts.cyclomatic,
    functions.map(valueOf.cyclomatic),
    CYCLOMATIC_BUCKETS,
    functionItems(valueOf.cyclomatic),
    String(functions.length),
    s.donut.functions,
  );
  const cognitiveSpec = bucketSpec(
    s.charts.cognitive,
    functions.map(valueOf.cognitive),
    COGNITIVE_BUCKETS,
    functionItems(valueOf.cognitive),
    String(functions.length),
    s.donut.functions,
  );
  const nestingSpec = bucketSpec(
    s.charts.nesting,
    functions.map(valueOf.nesting),
    NESTING_BUCKETS,
    functionItems(valueOf.nesting),
    String(functions.length),
    s.donut.functions,
  );
  const lengthSpec = bucketSpec(
    s.charts.functionLength,
    functions.map(valueOf.loc),
    LENGTH_BUCKETS,
    functionItems(valueOf.loc),
    String(functions.length),
    s.donut.functions,
  );
  const paramsSpec = bucketSpec(
    s.charts.parameters,
    functions.map(valueOf.params),
    PARAM_BUCKETS,
    functionItems(valueOf.params),
    String(functions.length),
    s.donut.functions,
  );
  const maintainabilitySpec = bucketSpec(
    s.charts.maintainability,
    functions.map(valueOf.maintainability),
    MAINTAINABILITY_BUCKETS,
    functionItems(valueOf.maintainability),
    String(functions.length),
    s.donut.functions,
  );
  const volumeSpec = bucketSpec(
    s.charts.halsteadVolume,
    functions.map(valueOf.volume),
    VOLUME_BUCKETS,
    functionItems(valueOf.volume),
    String(functions.length),
    s.donut.functions,
  );
  const difficultySpec = bucketSpec(
    s.kpi.halsteadDifficulty,
    functions.map(valueOf.difficulty),
    DIFFICULTY_BUCKETS,
    functionItems(valueOf.difficulty),
    String(functions.length),
    s.donut.functions,
  );
  const fileSizeSpec = bucketSpec(
    s.charts.fileSize,
    files.map((file) => file.loc.code),
    FILE_SIZE_BUCKETS,
    fileItems((file) => file.loc.code),
    String(files.length),
    s.donut.files,
  );

  const locSpec: DrillSpec = {
    title: s.charts.linesOfCode,
    chart: "donut",
    segments: [
      { label: s.segment.code, value: report.summary.loc.code, color: "#58a6ff" },
      { label: s.segment.comment, value: report.summary.loc.comment, color: "#3fb950" },
      { label: s.segment.blank, value: report.summary.loc.blank, color: "#8b949e" },
    ],
    items: fileItems((file) => file.loc.code),
    centerValue: String(report.summary.loc.physical),
    centerLabel: s.donut.physical,
  };

  const languageSpec: DrillSpec = {
    title: s.charts.languages,
    chart: "donut",
    segments: Object.entries(report.summary.filesByLanguage)
      .sort((a, b) => b[1] - a[1])
      .map(([language, count], index) => ({
        label: language,
        value: count,
        color: PALETTE[index % PALETTE.length] ?? "#58a6ff",
      })),
    items: fileItems((file) => file.loc.code),
    centerValue: String(files.length),
    centerLabel: s.donut.files,
  };

  const kindsSpec: DrillSpec = {
    title: s.charts.functionKinds,
    chart: "donut",
    segments: functionKinds(functions),
    items: functionItems(valueOf.cyclomatic),
    centerValue: String(functions.length),
    centerLabel: s.donut.functions,
  };

  const markerSpec: DrillSpec = {
    title: s.charts.markers,
    chart: "donut",
    segments: markerSegments(report),
    items: fileItems(markerCount).filter((item) => item.value > 0),
    centerValue: String(
      report.summary.markers.todo + report.summary.markers.fixme + report.summary.markers.hack,
    ),
    centerLabel: s.charts.markers,
  };

  const ruleSpec: DrillSpec = {
    title: s.charts.ruleViolations,
    chart: "donut",
    segments: violationsByRule(report),
    items: violationItems(report),
    centerValue: String(report.summary.violations.total),
    centerLabel: s.charts.ruleViolations,
  };

  const commentTotal = report.summary.loc.code + report.summary.loc.comment;
  const density = commentTotal > 0 ? (report.summary.loc.comment / commentTotal) * 100 : 0;
  const markerTotal = report.summary.markers.todo + report.summary.markers.fixme + report.summary.markers.hack;

  const kpis: KpiEntry[] = [
    { label: s.kpi.maintainability, value: Math.round(report.summary.maintainability), color: maintainabilityColor(report.summary.maintainability), spec: fileSizeSpec },
    { label: s.kpi.files, value: files.length, spec: fileSizeSpec },
    { label: s.kpi.functions, value: functions.length, spec: cyclomaticSpec },
    { label: s.kpi.codeLines, value: report.summary.loc.code, spec: locSpec },
    { label: s.kpi.commentPct, value: round1(density), spec: locSpec },
    { label: s.kpi.avgCyclomatic, value: round1(report.summary.metrics.cyclomatic.mean), spec: cyclomaticSpec },
    { label: s.kpi.maxCyclomatic, value: report.summary.metrics.cyclomatic.max, color: complexityColor(report.summary.metrics.cyclomatic.max), spec: cyclomaticSpec },
    { label: s.kpi.avgCognitive, value: round1(report.summary.metrics.cognitive.mean), spec: cognitiveSpec },
    { label: s.kpi.maxCognitive, value: report.summary.metrics.cognitive.max, color: complexityColor(report.summary.metrics.cognitive.max), spec: cognitiveSpec },
    { label: s.kpi.maxNesting, value: report.summary.metrics.nesting.max, spec: nestingSpec },
    { label: s.kpi.avgFunctionLength, value: round1(report.summary.metrics.functionLoc.mean), spec: lengthSpec },
    { label: s.kpi.halsteadDifficulty, value: round1(report.summary.metrics.halsteadDifficulty.mean), spec: difficultySpec },
    { label: s.kpi.physicalLines, value: report.summary.loc.physical, spec: fileSizeSpec },
    { label: s.kpi.logicalLines, value: report.summary.loc.logical, spec: fileSizeSpec },
    { label: s.kpi.violations, value: report.summary.violations.total, color: report.summary.violations.total > 0 ? "#d29922" : undefined, spec: ruleSpec },
    { label: s.kpi.markers, value: markerTotal, color: markerTotal > 0 ? "#d29922" : undefined, spec: markerSpec },
  ];

  const charts: DrillSpec[] = [
    locSpec,
    languageSpec,
    cyclomaticSpec,
    cognitiveSpec,
    nestingSpec,
    lengthSpec,
    kindsSpec,
    maintainabilitySpec,
    paramsSpec,
    volumeSpec,
    fileSizeSpec,
  ];
  if (markerTotal > 0) charts.push(markerSpec);
  if (report.summary.violations.total > 0) charts.push(ruleSpec);

  const pending: Array<() => void> = [];
  const body = el(
    "div",
    { class: "dashboard-body" },
    el("div", { class: "stats-grid" }, ...kpis.map((entry) => kpiCard(entry, handlers))),
    el("div", { class: "donut-row" }, ...charts.map((spec) => chartCard(spec, handlers, pending))),
  );
  targets.body.replaceChildren(body);

  const run = (): void => {
    for (const init of pending) init();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else run();
}

function header(): HTMLElement {
  return el(
    "header",
    { class: "page__head" },
    el("h1", { class: "page__title", text: t().pages.dashboard }),
  );
}

function kpiCard(entry: KpiEntry, handlers: DashboardHandlers): HTMLElement {
  const valueNode = el("div", { class: "kpi__value" });
  if (entry.color) valueNode.style.color = entry.color;
  if (Number.isInteger(entry.value)) countUp(valueNode, entry.value);
  else valueNode.textContent = String(entry.value);

  return el(
    "button",
    {
      class: "kpi kpi--clickable",
      onClick: () => openDrilldown(entry.spec, { onJump: handlers.onJump }),
    },
    valueNode,
    el("div", { class: "kpi__label", text: entry.label }),
  );
}

function chartCard(
  spec: DrillSpec,
  handlers: DashboardHandlers,
  pending: Array<() => void>,
): HTMLElement {
  const host = el("div", { class: "chart-host" });
  pending.push(() => {
    const onSelect = (name: string): void =>
      openDrilldown(filterSpec(spec, name), { onJump: handlers.onJump });
    void (spec.chart === "bar"
      ? renderBar(host, spec.segments, onSelect)
      : renderDonut(host, spec.segments, spec.centerValue, spec.centerLabel, onSelect));
  });
  return el("div", { class: "donut-card" }, el("h3", { text: spec.title }), host);
}

function bucketLabel(value: number, ranges: readonly BucketRange[]): string {
  const index = ranges.findIndex((range) => value <= range.upTo);
  return ranges[index === -1 ? ranges.length - 1 : index]?.label ?? "";
}

function filterSpec(spec: DrillSpec, name: string): DrillSpec {
  const items = spec.items.filter((item) => {
    if (spec.ranges) return bucketLabel(item.value, spec.ranges) === name;
    if (item.category) return item.category === name;
    return true;
  });
  return { ...spec, title: `${spec.title} · ${name}`, items };
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

function violationItems(report: AnalysisReport): DrillItem[] {
  const items: DrillItem[] = [];
  for (const file of report.files) {
    for (const violation of file.violations) {
      items.push({
        label: violation.rule,
        file: file.path,
        line: violation.location.start.line,
        endLine: violation.location.end.line,
        value: violation.actual,
        category: violation.rule,
      });
    }
  }
  return items;
}

function markerCount(file: FileReport): number {
  return file.markers.todo + file.markers.fixme + file.markers.hack;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function allFunctions(report: AnalysisReport): Entry[] {
  const all: Entry[] = [];
  for (const file of report.files) {
    for (const fn of file.functions) all.push({ file: file.path, fn });
  }
  return all;
}
