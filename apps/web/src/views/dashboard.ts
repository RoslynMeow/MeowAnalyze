import type { AnalysisReport, FileReport, FunctionKind, FunctionReport } from "@meowanalyze/core";
import {
  bucketize,
  complexityColor,
  maintainabilityColor,
  PALETTE,
  severityColor,
  type BucketRange,
  type DonutSegment,
} from "../charts.js";
import { MODULES, type ModuleId } from "../dashboard-modules.js";
import { countUp, el, type ViewTargets } from "../dom.js";
import { openDrilldown, type DrillItem } from "../drilldown.js";
import { t } from "../i18n.js";
import { defaultPrefs, type DashboardPrefs } from "../prefs.js";

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
  detail?: string;
  spec: DrillSpec;
}

const CYCLOMATIC_BUCKETS: readonly BucketRange[] = [
  { upTo: 5, label: "1–5", severity: "good" },
  { upTo: 10, label: "6–10", severity: "warn" },
  { upTo: 20, label: "11–20", severity: "bad" },
  { upTo: Number.POSITIVE_INFINITY, label: "21+", severity: "critical" },
];

const COGNITIVE_BUCKETS: readonly BucketRange[] = [
  { upTo: 5, label: "0–5", severity: "good" },
  { upTo: 15, label: "6–15", severity: "warn" },
  { upTo: 30, label: "16–30", severity: "bad" },
  { upTo: Number.POSITIVE_INFINITY, label: "31+", severity: "critical" },
];

const NESTING_BUCKETS: readonly BucketRange[] = [
  { upTo: 0, label: "0", severity: "good" },
  { upTo: 2, label: "1–2", severity: "warn" },
  { upTo: 4, label: "3–4", severity: "bad" },
  { upTo: Number.POSITIVE_INFINITY, label: "5+", severity: "critical" },
];

const LENGTH_BUCKETS: readonly BucketRange[] = [
  { upTo: 10, label: "1–10", severity: "good" },
  { upTo: 30, label: "11–30", severity: "warn" },
  { upTo: 80, label: "31–80", severity: "bad" },
  { upTo: Number.POSITIVE_INFINITY, label: "80+", severity: "critical" },
];

const MAINTAINABILITY_BUCKETS: readonly BucketRange[] = [
  { upTo: 40, label: "<40", severity: "critical" },
  { upTo: 65, label: "40–65", severity: "warn" },
  { upTo: Number.POSITIVE_INFINITY, label: "65+", severity: "good" },
];

const PARAM_BUCKETS: readonly BucketRange[] = [
  { upTo: 0, label: "0", severity: "good" },
  { upTo: 2, label: "1–2", severity: "good" },
  { upTo: 4, label: "3–4", severity: "warn" },
  { upTo: Number.POSITIVE_INFINITY, label: "5+", severity: "critical" },
];

const VOLUME_BUCKETS: readonly BucketRange[] = [
  { upTo: 50, label: "0–50", severity: "good" },
  { upTo: 150, label: "51–150", severity: "warn" },
  { upTo: 400, label: "151–400", severity: "bad" },
  { upTo: Number.POSITIVE_INFINITY, label: "400+", severity: "critical" },
];

const DIFFICULTY_BUCKETS: readonly BucketRange[] = [
  { upTo: 5, label: "0–5", severity: "good" },
  { upTo: 15, label: "6–15", severity: "warn" },
  { upTo: 30, label: "16–30", severity: "bad" },
  { upTo: Number.POSITIVE_INFINITY, label: "30+", severity: "critical" },
];

const FILE_SIZE_BUCKETS: readonly BucketRange[] = [
  { upTo: 100, label: "1–100", severity: "good" },
  { upTo: 300, label: "101–300", severity: "warn" },
  { upTo: 600, label: "301–600", severity: "bad" },
  { upTo: Number.POSITIVE_INFINITY, label: "600+", severity: "critical" },
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
  prefs: DashboardPrefs = defaultPrefs(),
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
  const logicalSpec = bucketSpec(
    s.kpi.logicalLines,
    files.map((file) => file.loc.logical),
    FILE_SIZE_BUCKETS,
    fileItems((file) => file.loc.logical),
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
  const metrics = report.summary.metrics;
  const violations = report.summary.violations;

  const cardBuilders: Record<ModuleId, () => KpiEntry> = {
    maintainability: () => ({
      label: s.kpi.maintainability,
      value: Math.round(report.summary.maintainability),
      color: maintainabilityColor(report.summary.maintainability),
      spec: maintainabilitySpec,
    }),
    scale: () => ({
      label: s.kpi.scale,
      value: report.summary.loc.code,
      detail: s.kpiDetail.scale(files.length, functions.length),
      spec: fileSizeSpec,
    }),
    cyclomatic: () => ({
      label: s.kpi.maxCyclomatic,
      value: metrics.cyclomatic.max,
      color: complexityColor(metrics.cyclomatic.max),
      detail: s.kpiDetail.avg(round1(metrics.cyclomatic.mean)),
      spec: cyclomaticSpec,
    }),
    cognitive: () => ({
      label: s.kpi.maxCognitive,
      value: metrics.cognitive.max,
      color: complexityColor(metrics.cognitive.max),
      detail: s.kpiDetail.avg(round1(metrics.cognitive.mean)),
      spec: cognitiveSpec,
    }),
    nesting: () => ({ label: s.kpi.maxNesting, value: metrics.nesting.max, spec: nestingSpec }),
    functionLength: () => ({
      label: s.kpi.avgFunctionLength,
      value: round1(metrics.functionLoc.mean),
      spec: lengthSpec,
    }),
    params: () => ({ label: s.kpi.params, value: metrics.params.max, spec: paramsSpec }),
    halsteadVolume: () => ({
      label: s.kpi.halsteadVolume,
      value: round1(metrics.halsteadVolume.mean),
      spec: volumeSpec,
    }),
    halsteadDifficulty: () => ({
      label: s.kpi.halsteadDifficulty,
      value: round1(metrics.halsteadDifficulty.mean),
      spec: difficultySpec,
    }),
    loc: () => ({ label: s.charts.linesOfCode, value: report.summary.loc.physical, spec: locSpec }),
    logicalLines: () => ({ label: s.kpi.logicalLines, value: report.summary.loc.logical, spec: logicalSpec }),
    commentPct: () => ({ label: s.kpi.commentPct, value: round1(density), spec: locSpec }),
    languages: () => ({ label: s.charts.languages, value: files.length, spec: languageSpec }),
    functionKinds: () => ({ label: s.charts.functionKinds, value: functions.length, spec: kindsSpec }),
    markers: () => ({
      label: s.kpi.markers,
      value: markerTotal,
      color: markerTotal > 0 ? severityColor("warn") : undefined,
      spec: markerSpec,
    }),
    violations: () => ({
      label: s.kpi.violations,
      value: violations.total,
      color: violations.total > 0 ? severityColor("critical") : undefined,
      detail: markerTotal > 0 ? s.alerts.markers(markerTotal) : undefined,
      spec: ruleSpec,
    }),
  };

  const cards = MODULES.filter((module) => prefs.modules[module.id]).map((module) =>
    kpiCard(cardBuilders[module.id](), handlers),
  );
  targets.body.replaceChildren(
    el("div", { class: "dashboard-body" }, el("div", { class: "stats-grid stats-grid--core" }, ...cards)),
  );
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

  const children: HTMLElement[] = [valueNode];
  if (entry.detail) {
    children.push(el("div", { class: "kpi__detail", text: entry.detail }));
  }
  children.push(el("div", { class: "kpi__label", text: entry.label }));

  return el(
    "button",
    {
      class: "kpi kpi--clickable",
      onClick: () => openDrilldown(entry.spec, { onJump: handlers.onJump }),
    },
    ...children,
  );
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
