import {
  DEFAULT_THRESHOLDS,
  type AnalysisReport,
  type FileReport,
  type FunctionKind,
  type FunctionReport,
  type Thresholds,
} from "@meowanalyze/core";
import {
  bucketize,
  maintainabilityColor,
  PALETTE,
  severityColor,
  type BucketRange,
  type DonutSegment,
} from "../charts.js";
import { MODULES, type ModuleId } from "../dashboard-modules.js";
import { countUp, el, type ViewTargets } from "../dom.js";
import { openDrilldown, type DrillItem } from "../drilldown.js";
import { renderGauge } from "../echarts.js";
import { t } from "../i18n.js";
import { brandIcon, SUPPORTED_LANGUAGES } from "../languages.js";
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

/** Green under the limit, amber within 1.5×, red beyond — lower is better. */
function thresholdColor(value: number, limit: number): string {
  if (value <= limit) return severityColor("good");
  if (value <= limit * 1.5) return severityColor("warn");
  return severityColor("critical");
}

function languageOf(id: string) {
  return SUPPORTED_LANGUAGES.find((language) => language.id === id);
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

// Visual Studio's bands: 0–9 red, 10–19 yellow, 20–100 green.
const MAINTAINABILITY_BUCKETS: readonly BucketRange[] = [
  { upTo: 9.999, label: "0–9", severity: "critical" },
  { upTo: 19.999, label: "10–19", severity: "warn" },
  { upTo: Number.POSITIVE_INFINITY, label: "20+", severity: "good" },
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
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
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
  const metrics = report.summary.metrics;

  const cardBuilders: Record<ModuleId, () => KpiEntry> = {
    maintainability: () => ({
      label: s.kpi.maintainability,
      value: Math.round(report.summary.maintainability),
      color: maintainabilityColor(report.summary.maintainability),
      detail: maintainabilityGrade(report.summary.maintainability),
      spec: maintainabilitySpec,
    }),
    cyclomatic: () => ({
      label: s.kpi.maxCyclomatic,
      value: metrics.cyclomatic.max,
      color: thresholdColor(metrics.cyclomatic.max, thresholds.cyclomatic),
      detail: s.kpiDetail.avg(round1(metrics.cyclomatic.mean)),
      spec: cyclomaticSpec,
    }),
    cognitive: () => ({
      label: s.kpi.maxCognitive,
      value: metrics.cognitive.max,
      color: thresholdColor(metrics.cognitive.max, thresholds.cognitive),
      detail: s.kpiDetail.avg(round1(metrics.cognitive.mean)),
      spec: cognitiveSpec,
    }),
    nesting: () => ({
      label: s.kpi.maxNesting,
      value: metrics.nesting.max,
      color: thresholdColor(metrics.nesting.max, thresholds.nesting),
      detail: s.kpiDetail.avg(round1(metrics.nesting.mean)),
      spec: nestingSpec,
    }),
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
  };

  const enabled = MODULES.filter((module) => prefs.modules[module.id]);
  const heroOn = prefs.modules.maintainability ?? false;

  const restCards = enabled
    .filter((module) => !(heroOn && module.id === "maintainability"))
    .map((module) => kpiCard(cardBuilders[module.id](), handlers));

  const blocks: HTMLElement[] = [];
  if (heroOn) {
    blocks.push(
      hero(report, maintainabilitySpec, markerSpec, ruleSpec, fileSizeSpec, languageSpec, handlers),
    );
  }
  blocks.push(
    el(
      "div",
      { class: "dashboard-insights" },
      attentionCard(report, handlers),
      locCard(report, locSpec, kindsSpec, density, handlers),
    ),
  );
  blocks.push(el("div", { class: "stats-grid stats-grid--core" }, ...restCards));

  targets.body.replaceChildren(el("div", { class: "dashboard-body" }, ...blocks));
}

/* ------------------------------------------------------------------ */
/* Hero: maintainability gauge + file distribution grid                */
/* ------------------------------------------------------------------ */

function hero(
  report: AnalysisReport,
  maintainabilitySpec: DrillSpec,
  markerSpec: DrillSpec,
  ruleSpec: DrillSpec,
  fileSizeSpec: DrillSpec,
  languageSpec: DrillSpec,
  handlers: DashboardHandlers,
): HTMLElement {
  const s = t().dashboard;
  const score = Math.round(report.summary.maintainability);
  const color = maintainabilityColor(report.summary.maintainability);

  const gauge = el("div", { class: "hero-score__gauge" });
  const main = el(
    "button",
    {
      class: "hero-score__main",
      onClick: () => openDrilldown(maintainabilitySpec, { onJump: handlers.onJump }),
    },
    el("span", { class: "hero-score__label", text: s.kpi.maintainability }),
    gauge,
    el("span", {
      class: "hero-score__grade",
      text: maintainabilityGrade(report.summary.maintainability),
    }),
  );
  main.type = "button";
  void renderGauge(gauge, score, color);

  const markers = report.summary.markers;
  const markerTotal = markers.todo + markers.fixme + markers.hack;
  const violationTotal = report.summary.violations.total;

  const alerts = el(
    "div",
    { class: "hero-score__alerts" },
    heroAlert(
      markerTotal,
      s.kpi.markers,
      markerTotal > 0 ? severityColor("warn") : severityColor("good"),
      markerSpec,
      handlers,
    ),
    heroAlert(
      violationTotal,
      s.kpi.violations,
      violationTotal > 0 ? severityColor("critical") : severityColor("good"),
      ruleSpec,
      handlers,
    ),
  );

  return el(
    "section",
    { class: "dashboard-hero" },
    el("section", { class: "hero-score" }, main, alerts),
    fileDistribution(report, fileSizeSpec, languageSpec, handlers),
  );
}

/** A small clickable counter shown inside the maintainability hero. */
function heroAlert(
  value: number,
  label: string,
  color: string,
  spec: DrillSpec,
  handlers: DashboardHandlers,
): HTMLElement {
  const valueNode = el("span", { class: "hero-alert__value", text: String(value) });
  valueNode.style.color = color;
  const node = el(
    "button",
    {
      class: "hero-alert",
      onClick: () => openDrilldown(spec, { onJump: handlers.onJump }),
    },
    valueNode,
    el("span", { class: "hero-alert__label", text: label }),
  );
  node.type = "button";
  return node;
}

function folderName(root: string): string {
  const parts = root.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] ?? root;
}

/** Per-file grid plus the project heading and scale summary. */
function fileDistribution(
  report: AnalysisReport,
  fileSizeSpec: DrillSpec,
  languageSpec: DrillSpec,
  handlers: DashboardHandlers,
): HTMLElement {
  const s = t().dashboard;
  const files = report.files;
  const root = report.root || "—";

  const cells = files.map((file) => {
    const cell = el("button", {
      class: "file-cell",
      title: `${file.path} · ${s.kpi.maintainability} ${Math.round(file.maintainability)}`,
      onClick: () =>
        handlers.onJump({ label: file.path, file: file.path, value: file.maintainability }),
    });
    cell.type = "button";
    cell.style.background = maintainabilityColor(file.maintainability);
    return cell;
  });

  const stats = el("button", {
    class: "file-views__stats",
    text: `${files.length} ${s.donut.files}`,
    onClick: () => openDrilldown(fileSizeSpec, { onJump: handlers.onJump }),
  });
  stats.type = "button";

  const languages = Object.entries(report.summary.filesByLanguage).sort(
    (a, b) => b[1] - a[1],
  );
  const chips = el(
    "div",
    { class: "lang-chips" },
    ...languages.map(([id, count]) => {
      const language = languageOf(id);
      const chip = el("button", {
        class: "lang-chip",
        onClick: () => openDrilldown(languageSpec, { onJump: handlers.onJump }),
      });
      chip.type = "button";
      if (language?.icon) chip.append(brandIcon(language.icon, 14));
      chip.append(
        el("span", { class: "lang-chip__name", text: language?.name ?? id }),
        el("span", { class: "lang-chip__count", text: String(count) }),
      );
      return chip;
    }),
  );
  chips.hidden = languages.length === 0;

  return el(
    "div",
    { class: "file-views" },
    el(
      "div",
      { class: "file-views__head" },
      el(
        "div",
        { class: "file-views__project" },
        el("span", { class: "file-views__title", text: s.fileMap }),
        el("span", { class: "file-views__folder", text: folderName(root), title: root }),
      ),
      stats,
    ),
    chips,
    el("div", { class: "file-grid" }, ...cells),
  );
}

/** Ranked list of files worth a look: large and hard to maintain first. */
function attentionCard(report: AnalysisReport, handlers: DashboardHandlers): HTMLElement {
  const s = t().dashboard;
  const ranked = [...report.files]
    .filter((file) => file.loc.code > 0)
    .sort(
      (a, b) =>
        b.loc.code * (100 - b.maintainability) - a.loc.code * (100 - a.maintainability),
    )
    .slice(0, 8);

  const rows = ranked.map((file, index) => {
    const row = el(
      "button",
      {
        class: "attention__row",
        onClick: () =>
          handlers.onJump({ label: file.path, file: file.path, value: file.maintainability }),
      },
      el("span", { class: "attention__rank", text: String(index + 1) }),
      el("span", { class: "attention__path", text: file.path }),
      el("span", { class: "attention__loc", text: `${file.loc.code}` }),
      el("span", {
        class: "attention__mi",
        text: `MI ${Math.round(file.maintainability)}`,
      }),
    );
    row.type = "button";
    row.style.setProperty("--row-color", maintainabilityColor(file.maintainability));
    return row;
  });

  const list = el("div", { class: "attention__list" }, ...rows);
  list.hidden = rows.length === 0;

  return el(
    "section",
    { class: "attention" },
    el(
      "div",
      { class: "attention__head" },
      el("span", { class: "attention__title", text: s.attention }),
      el("span", { class: "attention__hint", text: s.attentionHint }),
    ),
    list,
  );
}

const LOC_COLORS = { code: "#58a6ff", comment: "#3fb950", blank: "#8b949e" } as const;

/**
 * Two composition slots stacked in one card: code-line make-up (with logical
 * lines and comment ratio) and the function-kind split. Each opens its drawer.
 */
function locCard(
  report: AnalysisReport,
  locSpec: DrillSpec,
  kindsSpec: DrillSpec,
  density: number,
  handlers: DashboardHandlers,
): HTMLElement {
  const s = t().dashboard;
  const loc = report.summary.loc;

  const bar = (segments: readonly DonutSegment[]): HTMLElement => {
    const total = Math.max(1, segments.reduce((sum, item) => sum + item.value, 0));
    return el(
      "div",
      { class: "loc-card__bar" },
      ...segments.map((item) => {
        const piece = el("span", { class: "loc-card__seg" });
        piece.style.width = `${(item.value / total) * 100}%`;
        piece.style.background = item.color;
        return piece;
      }),
    );
  };

  const legend = (segments: readonly DonutSegment[]): HTMLElement =>
    el(
      "div",
      { class: "loc-card__legend" },
      ...segments.map((item) => {
        const dot = el("i", { class: "loc-card__dot" });
        dot.style.background = item.color;
        return el(
          "span",
          { class: "loc-card__legend-item" },
          dot,
          el("span", { class: "loc-card__legend-label", text: item.label }),
          el("span", { class: "loc-card__legend-value", text: String(item.value) }),
        );
      }),
    );

  const slot = (
    title: string,
    totalText: string,
    segments: readonly DonutSegment[],
    footer: HTMLElement | undefined,
    spec: DrillSpec,
  ): HTMLElement => {
    const node = el(
      "button",
      {
        class: "loc-card__slot",
        onClick: () => openDrilldown(spec, { onJump: handlers.onJump }),
      },
      el(
        "div",
        { class: "loc-card__head" },
        el("span", { class: "loc-card__title", text: title }),
        el("span", { class: "loc-card__total", text: totalText }),
      ),
      bar(segments),
      legend(segments),
      footer,
    );
    node.type = "button";
    return node;
  };

  const locSegments: DonutSegment[] = [
    { label: s.segment.code, value: loc.code, color: LOC_COLORS.code },
    { label: s.segment.comment, value: loc.comment, color: LOC_COLORS.comment },
    { label: s.segment.blank, value: loc.blank, color: LOC_COLORS.blank },
  ];
  const kindTotal = kindsSpec.segments.reduce((sum, item) => sum + item.value, 0);

  return el(
    "section",
    { class: "loc-card" },
    slot(
      s.charts.linesOfCode,
      `${loc.physical} ${s.donut.physical} / ${s.kpiDetail.functionLength(
        round1(report.summary.metrics.functionLoc.mean),
      )}`,
      locSegments,
      el(
        "div",
        { class: "loc-card__stats" },
        el("span", { text: `${s.kpi.logicalLines} ${loc.logical}` }),
        el("span", { text: `${s.kpi.commentPct} ${round1(density)}%` }),
      ),
      locSpec,
    ),
    slot(
      s.charts.functionKinds,
      `${kindTotal} ${s.donut.functions} / ${s.kpiDetail.params(
        round1(report.summary.metrics.params.mean),
      )}`,
      kindsSpec.segments,
      undefined,
      kindsSpec,
    ),
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

function maintainabilityGrade(value: number): string {
  const labels = t().dashboard.maintainability;
  if (value < 10) return labels.low;
  if (value < 20) return labels.moderate;
  return labels.healthy;
}

function allFunctions(report: AnalysisReport): Entry[] {
  const all: Entry[] = [];
  for (const file of report.files) {
    for (const fn of file.functions) all.push({ file: file.path, fn });
  }
  return all;
}
