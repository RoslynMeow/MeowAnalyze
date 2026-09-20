import pc from "picocolors";
import type {
  AnalysisReport,
  Distribution,
  FunctionReport,
  LocStats,
  Violation,
} from "@meowanalyze/core";

export interface TableOptions {
  /** How many items in the "top" / violations lists. */
  top: number;
  quiet: boolean;
}

interface Column {
  header: string;
  align?: "left" | "right";
}

const ANSI = /\u001b\[[0-9;]*m/g;

function visibleLength(text: string): number {
  return text.replace(ANSI, "").length;
}

function pad(text: string, width: number, align: "left" | "right"): string {
  const fill = " ".repeat(Math.max(0, width - visibleLength(text)));
  return align === "right" ? fill + text : text + fill;
}

/** Minimal box-drawing table renderer (ANSI aware). */
function renderTable(columns: Column[], rows: string[][]): string {
  const widths = columns.map((column, index) =>
    Math.max(
      visibleLength(column.header),
      ...rows.map((row) => visibleLength(row[index] ?? "")),
    ),
  );

  const border = (left: string, mid: string, right: string): string =>
    left + widths.map((w) => "─".repeat(w + 2)).join(mid) + right;

  const formatRow = (cells: string[], bold: boolean): string => {
    const rendered = cells.map((cell, index) => {
      const width = widths[index] ?? 0;
      const align = columns[index]?.align ?? "left";
      const value = bold ? pc.bold(cell) : cell;
      return " " + pad(value, width, align) + " ";
    });
    return "│" + rendered.join("│") + "│";
  };

  const header = formatRow(
    columns.map((c) => c.header),
    true,
  );
  const body = rows.map((row) => formatRow(row, false));

  return [
    border("┌", "┬", "┐"),
    header,
    border("├", "┼", "┤"),
    ...body,
    border("└", "┴", "┘"),
  ].join("\n");
}

export function renderReport(
  report: AnalysisReport,
  options: TableOptions,
): string {
  const lines: string[] = [];

  lines.push(
    `${pc.bold(pc.cyan("MeowAnalyze"))} ${pc.dim(`v${report.toolVersion}`)}`,
  );
  lines.push(`${pc.dim("root:")} ${report.root}`);
  lines.push(
    `${pc.dim("files:")} ${report.summary.files}` +
      `   ${pc.dim("functions:")} ${report.summary.metrics.cyclomatic.count}` +
      `   ${pc.dim("maintainability:")} ${report.summary.maintainability.toFixed(1)}` +
      `   ${pc.dim("time:")} ${report.durationMs}ms`,
  );
  const { markers } = report.summary;
  if (markers.todo + markers.fixme + markers.hack > 0) {
    lines.push(
      `${pc.dim("markers:")} TODO ${markers.todo}  FIXME ${markers.fixme}  HACK ${markers.hack}`,
    );
  }
  lines.push("");

  lines.push(section("Lines of code"));
  lines.push(renderLocTable(report.summary.loc));
  lines.push("");

  lines.push(section("Languages"));
  lines.push(renderLanguages(report));
  lines.push("");

  lines.push(section("Complexity (per function)"));
  lines.push(renderMetricsTable(report));
  lines.push("");

  if (!options.quiet) {
    const top = topFunctions(report, options.top);
    if (top.length > 0) {
      lines.push(section(`Most complex functions (top ${top.length})`));
      lines.push(renderTopFunctions(top));
      lines.push("");
    }

    const violations = allViolations(report);
    if (violations.length > 0) {
      lines.push(section(`Violations (${report.summary.violations.total})`));
      lines.push(renderViolations(violations.slice(0, options.top)));
      lines.push("");
    }
  }

  if (report.diagnostics.length > 0) {
    lines.push(section(`Diagnostics (${report.diagnostics.length})`));
    for (const diagnostic of report.diagnostics.slice(0, options.top)) {
      lines.push(`  ${levelTag(diagnostic.level)} ${diagnostic.path} — ${diagnostic.message}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function section(title: string): string {
  return pc.bold(pc.underline(title));
}

function renderLocTable(loc: LocStats): string {
  return renderTable(
    [{ header: "physical" }, { header: "code" }, { header: "comment" }, { header: "blank" }, { header: "logical" }],
    [[
      String(loc.physical),
      String(loc.code),
      String(loc.comment),
      String(loc.blank),
      String(loc.logical),
    ]],
  );
}

function renderLanguages(report: AnalysisReport): string {
  const entries = Object.entries(report.summary.filesByLanguage).sort(
    (a, b) => b[1] - a[1],
  );
  return renderTable(
    [{ header: "language" }, { header: "files", align: "right" }],
    entries.map(([language, count]) => [language, String(count)]),
  );
}

const METRIC_LABELS: Array<[string, (m: AnalysisReport["summary"]["metrics"]) => Distribution]> = [
  ["cyclomatic", (m) => m.cyclomatic],
  ["cognitive", (m) => m.cognitive],
  ["nesting", (m) => m.nesting],
  ["function loc", (m) => m.functionLoc],
  ["params", (m) => m.params],
  ["maintainability", (m) => m.maintainability],
  ["halstead volume", (m) => m.halsteadVolume],
];

function renderMetricsTable(report: AnalysisReport): string {
  const rows = METRIC_LABELS.map(([label, pick]) => {
    const d = pick(report.summary.metrics);
    return [
      label,
      String(d.count),
      formatNumber(d.sum),
      formatNumber(d.min),
      formatNumber(d.max),
      d.mean.toFixed(2),
    ];
  });
  return renderTable(
    [
      { header: "metric" },
      { header: "count", align: "right" },
      { header: "sum", align: "right" },
      { header: "min", align: "right" },
      { header: "max", align: "right" },
      { header: "mean", align: "right" },
    ],
    rows,
  );
}

function topFunctions(
  report: AnalysisReport,
  limit: number,
): Array<{ file: string; fn: FunctionReport }> {
  const all: Array<{ file: string; fn: FunctionReport }> = [];
  for (const file of report.files) {
    for (const fn of file.functions) all.push({ file: file.path, fn });
  }
  all.sort(
    (a, b) =>
      b.fn.cyclomatic - a.fn.cyclomatic ||
      b.fn.maxNesting - a.fn.maxNesting ||
      b.fn.loc - a.fn.loc,
  );
  return all.slice(0, limit);
}

function renderTopFunctions(
  items: Array<{ file: string; fn: FunctionReport }>,
): string {
  return renderTable(
    [
      { header: "cyclo", align: "right" },
      { header: "cog", align: "right" },
      { header: "nest", align: "right" },
      { header: "loc", align: "right" },
      { header: "function" },
      { header: "location" },
    ],
    items.map(({ file, fn }) => [
      colorComplexity(fn.cyclomatic),
      String(fn.cognitive),
      String(fn.maxNesting),
      String(fn.loc),
      fn.name,
      pc.dim(`${file}:${fn.range.start.line}`),
    ]),
  );
}

function colorComplexity(value: number): string {
  const text = String(value);
  if (value >= 20) return pc.red(text);
  if (value >= 10) return pc.yellow(text);
  return text;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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
    for (const violation of file.violations) all.push({ file: file.path, violation });
  }
  all.sort(
    (a, b) =>
      rank[a.violation.level] - rank[b.violation.level] ||
      b.violation.actual - a.violation.actual,
  );
  return all;
}

function renderViolations(
  items: Array<{ file: string; violation: Violation }>,
): string {
  return renderTable(
    [
      { header: "level" },
      { header: "rule" },
      { header: "actual", align: "right" },
      { header: "limit", align: "right" },
      { header: "location" },
    ],
    items.map(({ file, violation }) => [
      levelTag(violation.level),
      violation.rule,
      String(violation.actual),
      String(violation.limit),
      pc.dim(`${file}:${violation.location.start.line}`),
    ]),
  );
}

function levelTag(level: Violation["level"]): string {
  switch (level) {
    case "error":
      return pc.red("error");
    case "warning":
      return pc.yellow("warn");
    case "info":
      return pc.dim("info");
  }
}
