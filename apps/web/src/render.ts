import type {
  AnalysisReport,
  Distribution,
  FunctionReport,
  Violation,
} from "@meowanalyze/core";

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
    node.append(typeof child === "string" || typeof child === "number" ? String(child) : child);
  }
  return node;
}

function table(headers: string[], rows: Child[][], aligns?: Array<"left" | "right">): HTMLTableElement {
  const thead = el(
    "thead",
    {},
    el(
      "tr",
      {},
      ...headers.map((header, index) =>
        el("th", {
          class: aligns?.[index] === "right" ? "right" : undefined,
          text: header,
        }),
      ),
    ),
  );
  const tbody = el(
    "tbody",
    {},
    ...rows.map((row) =>
      el(
        "tr",
        {},
        ...row.map((cell, index) =>
          el(
            "td",
            { class: aligns?.[index] === "right" ? "right" : undefined },
            cell ?? "",
          ),
        ),
      ),
    ),
  );
  return el("table", {}, thead, tbody);
}

function section(title: string, ...children: Child[]): HTMLElement {
  return el("section", { class: "card" }, el("h2", { text: title }), ...children);
}

function complexityClass(value: number): string {
  if (value >= 20) return "bad";
  if (value >= 10) return "warn";
  return "";
}

function metricText(value: number, digits = 2): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function renderReport(root: HTMLElement, report: AnalysisReport): void {
  root.replaceChildren();

  const { summary } = report;

  root.append(
    section(
      "Overview",
      el(
        "div",
        { class: "cards" },
        statCard("Files", String(summary.files)),
        statCard("Functions", String(summary.metrics.cyclomatic.count)),
        statCard("Code lines", String(summary.loc.code)),
        statCard("Violations", String(summary.violations.total), summary.violations.total > 0 ? "warn" : ""),
      ),
      el("div", { class: "meta" }, `root: ${report.root} · ${report.durationMs}ms · v${report.toolVersion}`),
    ),
  );

  root.append(
    section(
      "Lines of code",
      table(
        ["physical", "code", "comment", "blank", "logical"],
        [
          [
            summary.loc.physical,
            summary.loc.code,
            summary.loc.comment,
            summary.loc.blank,
            summary.loc.logical,
          ],
        ],
        ["right", "right", "right", "right", "right"],
      ),
    ),
  );

  root.append(
    section(
      "Languages",
      table(
        ["language", "files"],
        Object.entries(summary.filesByLanguage)
          .sort((a, b) => b[1] - a[1])
          .map(([language, count]) => [language, count]),
        ["left", "right"],
      ),
    ),
  );

  const dist: Array<[string, Distribution]> = [
    ["cyclomatic", summary.metrics.cyclomatic],
    ["nesting", summary.metrics.nesting],
    ["function loc", summary.metrics.functionLoc],
    ["params", summary.metrics.params],
  ];
  root.append(
    section(
      "Complexity (per function)",
      table(
        ["metric", "count", "sum", "min", "max", "mean"],
        dist.map(([name, d]) => [
          name,
          d.count,
          d.sum,
          d.min,
          d.max,
          metricText(d.mean),
        ]),
        ["left", "right", "right", "right", "right", "right"],
      ),
    ),
  );

  const top = topFunctions(report, 15);
  if (top.length > 0) {
    root.append(
      section(
        "Most complex functions",
        table(
          ["cyclo", "nest", "loc", "function", "location"],
          top.map(({ file, fn }) => [
            el("span", {
              class: complexityClass(fn.cyclomatic),
              text: String(fn.cyclomatic),
            }),
            fn.maxNesting,
            fn.loc,
            fn.name,
            `${file}:${fn.range.start.line}`,
          ]),
          ["right", "right", "right", "left", "left"],
        ),
      ),
    );
  }

  const violations = allViolations(report);
  if (violations.length > 0) {
    root.append(
      section(
        `Violations (${summary.violations.total})`,
        table(
          ["level", "rule", "actual", "limit", "location"],
          violations.slice(0, 50).map(({ file, violation }) => [
            el("span", { class: `level level--${violation.level}`, text: violation.level }),
            violation.rule,
            violation.actual,
            violation.limit,
            `${file}:${violation.location.start.line}`,
          ]),
          ["left", "left", "right", "right", "left"],
        ),
      ),
    );
  }

  root.append(section("Files", renderFiles(report)));

  root.append(
    section(
      "Export",
      el("button", {
        class: "button",
        text: "Download JSON report",
        onClick: () => downloadJson(report),
      }),
    ),
  );
}

function statCard(label: string, value: string, tone = ""): HTMLElement {
  return el(
    "div",
    { class: `stat ${tone}` },
    el("div", { class: "stat__value", text: value }),
    el("div", { class: "stat__label", text: label }),
  );
}

function renderFiles(report: AnalysisReport): HTMLElement {
  const container = el("div", { class: "files" });
  for (const file of report.files) {
    const details = el(
      "details",
      { class: "file" },
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
            ? el("span", { class: "pill warn", text: `${file.violations.length} violations` })
            : null,
        ),
      ),
    );
    if (file.functions.length > 0) {
      details.append(
        table(
          ["cyclo", "nest", "loc", "params", "function", "line"],
          file.functions
            .slice()
            .sort((a, b) => b.cyclomatic - a.cyclomatic)
            .map((fn) => [
              el("span", { class: complexityClass(fn.cyclomatic), text: String(fn.cyclomatic) }),
              fn.maxNesting,
              fn.loc,
              fn.params,
              fn.name,
              fn.range.start.line,
            ]),
          ["right", "right", "right", "right", "left", "right"],
        ),
      );
    }
    container.append(details);
  }
  return container;
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

function allViolations(
  report: AnalysisReport,
): Array<{ file: string; violation: Violation }> {
  const rank: Record<Violation["level"], number> = { error: 0, warning: 1, info: 2 };
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

function downloadJson(report: AnalysisReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = el("a", {});
  link.href = url;
  link.download = "meowanalyze-report.json";
  link.click();
  URL.revokeObjectURL(url);
}
