import type {
  AnalysisReport,
  Distribution,
  FunctionReport,
  Violation,
} from "@meowanalyze/core";
import {
  barList,
  complexityColor,
  donutChart,
  histogramChart,
  PALETTE,
  treemapChart,
  type DonutSegment,
} from "./charts.js";

type Child = Node | string | number | null | undefined;

interface ElProps {
  class?: string;
  text?: string;
  title?: string;
  onClick?: (event: MouseEvent) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.title) node.title = props.title;
  if (props.onClick) {
    node.addEventListener("click", (event) => props.onClick?.(event as MouseEvent));
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : child,
    );
  }
  return node;
}

function card(title: string, ...children: Child[]): HTMLElement {
  return el("section", { class: "card" }, el("h2", { text: title }), ...children);
}

/* ------------------------------------------------------------------ */
/* Sortable table                                                      */
/* ------------------------------------------------------------------ */

interface Column {
  header: string;
  align?: "left" | "right";
  sortable?: boolean;
}

interface Cell {
  content: Node | string | number;
  value?: string | number;
  class?: string;
}

function cellValue(cell: Cell): string | number {
  if (cell.value !== undefined) return cell.value;
  if (typeof cell.content === "string" || typeof cell.content === "number") {
    return cell.content;
  }
  return cell.content.textContent ?? "";
}

function dataTable(columns: Column[], rows: Cell[][]): HTMLTableElement {
  const table = el("table", { class: "data" });
  const headRow = el("tr");
  const tbody = el("tbody");
  let sortIndex = -1;
  let direction: 1 | -1 = 1;

  const renderBody = (): void => {
    const data =
      sortIndex < 0
        ? rows
        : [...rows].sort((a, b) => {
            const av = cellValue(a[sortIndex] ?? { content: "" });
            const bv = cellValue(b[sortIndex] ?? { content: "" });
            if (typeof av === "number" && typeof bv === "number") {
              return (av - bv) * direction;
            }
            return String(av).localeCompare(String(bv)) * direction;
          });
    tbody.replaceChildren(
      ...data.map((row) =>
        el(
          "tr",
          {},
          ...row.map((cell, index) =>
            el("td", { class: alignClass(columns[index], cell) }, cell.content),
          ),
        ),
      ),
    );
  };

  const arrows: HTMLElement[] = [];
  columns.forEach((column, index) => {
    const arrow = el("span", { class: "sort-arrow" });
    const th = el("th", { class: alignClass(column) }, column.header, arrow);
    if (column.sortable !== false) {
      th.classList.add("sortable");
      th.addEventListener("click", () => {
        if (sortIndex === index) {
          direction = direction === 1 ? -1 : 1;
        } else {
          sortIndex = index;
          direction = 1;
        }
        arrows.forEach((node, i) => {
          node.textContent = i === sortIndex ? (direction === 1 ? " ▲" : " ▼") : "";
        });
        renderBody();
      });
    }
    arrows.push(arrow);
    headRow.append(th);
  });

  renderBody();
  table.append(el("thead", {}, headRow), tbody);
  return table;
}

function alignClass(
  column: Column | undefined,
  cell?: Cell,
): string | undefined {
  const align = cell?.class ?? (column?.align === "right" ? "right" : undefined);
  return align;
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

export function renderReport(root: HTMLElement, report: AnalysisReport): void {
  root.replaceChildren();

  const fileEls = new Map<string, HTMLDetailsElement>();
  const openFile = (key: string): void => {
    const target = fileEls.get(key);
    if (!target) return;
    target.open = true;
    target.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target.classList.add("flash");
    window.setTimeout(() => target.classList.remove("flash"), 1200);
  };

  const filesSection = buildFiles(report, fileEls);

  root.append(
    buildOverview(report),
    buildCharts(report, openFile),
    buildMetrics(report),
  );

  const violations = buildViolations(report);
  if (violations) root.append(violations);

  root.append(filesSection, buildExport(report));
}

function buildOverview(report: AnalysisReport): HTMLElement {
  const { summary } = report;
  return card(
    "Overview",
    el(
      "div",
      { class: "cards" },
      statCard("Files", String(summary.files)),
      statCard("Functions", String(summary.metrics.cyclomatic.count)),
      statCard("Code lines", String(summary.loc.code)),
      statCard(
        "Violations",
        String(summary.violations.total),
        summary.violations.total > 0 ? "warn" : "",
      ),
    ),
    el(
      "div",
      { class: "meta" },
      `root: ${report.root} · ${report.durationMs}ms · v${report.toolVersion}`,
    ),
  );
}

function buildCharts(
  report: AnalysisReport,
  openFile: (key: string) => void,
): HTMLElement {
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
    const target = (event.target as SVGElement).closest("[data-key]");
    const key = target?.getAttribute("data-key");
    if (key) openFile(key);
  });

  const treemap = treemapChart(filesTreemap);
  treemap.addEventListener("click", (event) => {
    const target = (event.target as SVGElement).closest("[data-key]");
    const key = target?.getAttribute("data-key");
    if (key) openFile(key);
  });

  return card(
    "Charts",
    el(
      "div",
      { class: "charts" },
      el(
        "div",
        { class: "chart-block chart-block--wide" },
        el("h3", { text: "Cyclomatic complexity distribution" }),
        histogramChart(cyclomatic),
        el("p", {
          class: "chart-caption",
          text: "Functions per complexity score. Bars turn yellow at 10 and red at 20.",
        }),
      ),
      el(
        "div",
        { class: "chart-block chart-block--wide" },
        el("h3", { text: "Most complex functions (click to open file)" }),
        topBar,
      ),
      el(
        "div",
        { class: "chart-block" },
        el("h3", { text: "Lines of code" }),
        donutWithLegend(
          locDonut,
          String(report.summary.loc.physical),
          "physical",
        ),
      ),
      el(
        "div",
        { class: "chart-block" },
        el("h3", { text: "Languages" }),
        donutWithLegend(
          languageSegments,
          String(report.summary.files),
          "files",
        ),
      ),
      el(
        "div",
        { class: "chart-block chart-block--wide" },
        el("h3", { text: "Files by code lines (color = max complexity)" }),
        treemap,
      ),
    ),
  );
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

const METRIC_LABELS: Array<
  [string, (metrics: AnalysisReport["summary"]["metrics"]) => Distribution]
> = [
  ["cyclomatic", (m) => m.cyclomatic],
  ["nesting", (m) => m.nesting],
  ["function loc", (m) => m.functionLoc],
  ["params", (m) => m.params],
];

function buildMetrics(report: AnalysisReport): HTMLElement {
  const rows: Cell[][] = METRIC_LABELS.map(([label, pick]) => {
    const d = pick(report.summary.metrics);
    return [
      { content: label },
      { content: d.count, value: d.count },
      { content: d.sum, value: d.sum },
      { content: d.min, value: d.min },
      { content: d.max, value: d.max },
      { content: metricText(d.mean), value: d.mean },
    ];
  });
  return card(
    "Complexity (per function)",
    dataTable(
      [
        { header: "metric" },
        { header: "count", align: "right" },
        { header: "sum", align: "right" },
        { header: "min", align: "right" },
        { header: "max", align: "right" },
        { header: "mean", align: "right" },
      ],
      rows,
    ),
  );
}

function buildViolations(report: AnalysisReport): HTMLElement | undefined {
  const violations = allViolations(report);
  if (violations.length === 0) return undefined;
  const rows: Cell[][] = violations.slice(0, 100).map(({ file, violation }) => [
    {
      content: el("span", {
        class: `level level--${violation.level}`,
        text: violation.level,
      }),
      value: violation.level,
    },
    { content: violation.rule },
    { content: violation.actual, value: violation.actual },
    { content: violation.limit, value: violation.limit },
    { content: `${file}:${violation.location.start.line}` },
  ]);
  return card(
    `Violations (${report.summary.violations.total})`,
    dataTable(
      [
        { header: "level" },
        { header: "rule" },
        { header: "actual", align: "right" },
        { header: "limit", align: "right" },
        { header: "location" },
      ],
      rows,
    ),
  );
}

function buildFiles(
  report: AnalysisReport,
  fileEls: Map<string, HTMLDetailsElement>,
): HTMLElement {
  const list = el("div", { class: "files" });

  const filter = document.createElement("input");
  filter.type = "search";
  filter.placeholder = "Filter files…";
  filter.className = "filter";
  filter.addEventListener("input", () => {
    const query = filter.value.trim().toLowerCase();
    for (const [path, node] of fileEls) {
      node.hidden = query.length > 0 && !path.toLowerCase().includes(query);
    }
  });

  for (const file of report.files) {
    const details = el("details", { class: "file" }) as HTMLDetailsElement;
    details.dataset.path = file.path;
    fileEls.set(file.path, details);

    details.append(
      el(
        "summary",
        {},
        el("span", { class: "file__path", text: file.path }),
        el(
          "span",
          { class: "file__badges" },
          el("span", { class: "pill", text: file.language }),
          el("span", { class: "pill", text: `${file.loc.code} code` }),
          el("span", { class: "pill", text: `logical ${file.loc.logical}` }),
          el("span", {
            class: `pill ${complexityClass(file.metrics.cyclomatic.max)}`,
            text: `max cyclo ${file.metrics.cyclomatic.max}`,
          }),
          file.violations.length > 0
            ? el("span", {
                class: "pill warn",
                text: `${file.violations.length} violations`,
              })
            : null,
        ),
      ),
    );

    if (file.functions.length > 0) {
      const rows: Cell[][] = file.functions.map((fn) => [
        {
          content: el("span", {
            class: complexityClass(fn.cyclomatic),
            text: String(fn.cyclomatic),
          }),
          value: fn.cyclomatic,
        },
        { content: fn.maxNesting, value: fn.maxNesting },
        { content: fn.loc, value: fn.loc },
        { content: fn.params, value: fn.params },
        { content: fn.name },
        { content: fn.range.start.line, value: fn.range.start.line },
      ]);
      details.append(
        dataTable(
          [
            { header: "cyclo", align: "right" },
            { header: "nest", align: "right" },
            { header: "loc", align: "right" },
            { header: "params", align: "right" },
            { header: "function" },
            { header: "line", align: "right" },
          ],
          rows,
        ),
      );
    }

    list.append(details);
  }

  return card(
    `Files (${report.files.length})`,
    el("div", { class: "files-toolbar" }, filter),
    list,
  );
}

function buildExport(report: AnalysisReport): HTMLElement {
  return card(
    "Export",
    el("button", {
      class: "button",
      text: "Download JSON report",
      onClick: () => downloadJson(report),
    }),
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function statCard(label: string, value: string, tone = ""): HTMLElement {
  return el(
    "div",
    { class: `stat ${tone}` },
    el("div", { class: "stat__value", text: value }),
    el("div", { class: "stat__label", text: label }),
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

function allViolations(
  report: AnalysisReport,
): Array<{ file: string; violation: Violation }> {
  const rank: Record<Violation["level"], number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  const all: Array<{ file: string; violation: Violation }> = [];
  for (const file of report.files) {
    for (const violation of file.violations) {
      all.push({ file: file.path, violation });
    }
  }
  all.sort(
    (a, b) =>
      rank[a.violation.level] - rank[b.violation.level] ||
      b.violation.actual - a.violation.actual,
  );
  return all;
}

function complexityClass(value: number): string {
  if (value >= 20) return "bad";
  if (value >= 10) return "warn";
  return "";
}

function metricText(value: number, digits = 2): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function downloadJson(report: AnalysisReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "meowanalyze-report.json";
  link.click();
  URL.revokeObjectURL(url);
}
