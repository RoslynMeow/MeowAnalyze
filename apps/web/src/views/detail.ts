import type { AnalysisReport, FileReport, FunctionReport } from "@meowanalyze/core";
import { complexityColor, maintainabilityColor } from "../charts.js";
import { el } from "../dom.js";
import { t } from "../i18n.js";
import { decodeContent } from "../sources.js";
import { dataTable, type Cell } from "../table.js";

export interface DetailHandlers {
  onSelect: (path: string) => void;
}

const MAX_SOURCE_LINES = 5000;

export function renderDetail(
  root: HTMLElement,
  report: AnalysisReport,
  sources: ReadonlyArray<{ path: string; content: Uint8Array | string }>,
  selectedPath: string | undefined,
  handlers: DetailHandlers,
): void {
  root.replaceChildren();

  const file = selectedPath
    ? report.files.find((entry) => entry.path === selectedPath)
    : undefined;
  const source = file
    ? sources.find((entry) => entry.path === file.path)
    : undefined;

  root.append(
    el(
      "header",
      { class: "page__head" },
      el(
        "div",
        {},
        el("h1", { class: "page__title", text: t().pages.detail }),
        el("p", {
          class: "page__meta",
          text: file ? file.path : t().detail.selectHint,
        }),
      ),
    ),
    el(
      "div",
      { class: "detail-layout" },
      fileList(report, file?.path, handlers),
      preview(file, source ? decodeContent(source.content) : undefined),
    ),
  );
}

function fileList(
  report: AnalysisReport,
  selected: string | undefined,
  handlers: DetailHandlers,
): HTMLElement {
  const list = el("div", { class: "file-list" });
  for (const file of report.files) {
    const node = el(
      "button",
      {
        class: `file-list__item${file.path === selected ? " file-list__item--active" : ""}`,
        onClick: () => handlers.onSelect(file.path),
      },
      el("span", { class: "file-list__path", text: file.path }),
      el(
        "span",
        { class: "file-list__meta" },
        el("span", { class: complexityClass(file.metrics.cyclomatic.max), text: `cyclo ${file.metrics.cyclomatic.max}` }),
        el("span", { text: `cog ${file.metrics.cognitive.max}` }),
        el("span", { text: `MI ${file.maintainability.toFixed(0)}` }),
      ),
    );
    list.append(node);
  }
  return el(
    "aside",
    { class: "file-list-pane" },
    el("h2", { class: "pane-title", text: `${t().detail.filesTitle} (${report.files.length})` }),
    list,
  );
}

function preview(file: FileReport | undefined, source: string | undefined): HTMLElement {
  const pane = el("div", { class: "preview-pane" });
  if (!file) {
    pane.append(el("p", { class: "preview-empty", text: t().detail.selectHint }));
    return pane;
  }

  const sourcePanel = source ? buildSource(source) : undefined;

  pane.append(
    el(
      "div",
      { class: "preview-head" },
      el("span", { class: "pill", text: file.language }),
      el("span", {
        class: "pill",
        text: t().detail.locPill(
          file.loc.physical,
          file.loc.code,
          file.loc.comment,
          file.loc.blank,
          file.loc.logical,
        ),
      }),
    ),
    kpis(file),
  );

  pane.append(
    section(
      t().detail.functionsTitle(file.functions.length),
      sourcePanel
        ? functionsTable(file, (fn) => sourcePanel.highlight(fn))
        : functionsTable(file, () => undefined),
    ),
  );

  if (sourcePanel) pane.append(sourcePanel.element);
  return pane;
}

function kpis(file: FileReport): HTMLElement {
  const s = t().detail.kpi;
  const maxCyclo = file.metrics.cyclomatic.max;
  const maxCognitive = file.metrics.cognitive.max;
  return el(
    "div",
    { class: "kpis" },
    miKpi(file.maintainability),
    kpi(s.functions, file.functions.length),
    kpi(s.maxCyclomatic, maxCyclo, complexityColor(maxCyclo)),
    kpi(s.maxCognitive, maxCognitive, complexityColor(maxCognitive)),
    kpi(s.maxNesting, file.metrics.nesting.max),
    kpi(s.codeLines, file.loc.code),
    kpi(s.violations, file.violations.length, file.violations.length > 0 ? "#d29922" : undefined),
  );
}

function kpi(label: string, value: number, color?: string): HTMLElement {
  const valueNode = el("div", { class: "kpi__value", text: String(value) });
  if (color) valueNode.style.color = color;
  return el("div", { class: "kpi" }, valueNode, el("div", { class: "kpi__label", text: label }));
}

function miKpi(value: number): HTMLElement {
  const valueNode = el("div", { class: "kpi__value", text: String(Math.round(value)) });
  valueNode.style.color = maintainabilityColor(value);
  return el("div", { class: "kpi" }, valueNode, el("div", { class: "kpi__label", text: "MI" }));
}

function section(title: string, ...children: Array<Node | string | null>): HTMLElement {
  return el("section", { class: "card" }, el("h2", { text: title }), ...children);
}

interface SourcePanel {
  element: HTMLElement;
  highlight: (fn: FunctionReport) => void;
}

function buildSource(source: string): SourcePanel {
  const lines = source.split(/\r?\n/);
  const pre = el("pre", { class: "source" });

  if (lines.length > MAX_SOURCE_LINES) {
    pre.append(el("div", { class: "source__too-large", text: t().detail.sourceTooLarge(lines.length) }));
    return { element: section(t().detail.source, pre), highlight: () => undefined };
  }

  const lineEls: HTMLElement[] = [];
  lines.forEach((text, index) => {
    const row = el(
      "div",
      { class: "source__line" },
      el("span", { class: "source__num", text: String(index + 1) }),
      el("span", { class: "source__code", text }),
    );
    lineEls.push(row);
    pre.append(row);
  });

  let active: HTMLElement[] = [];
  const highlight = (fn: FunctionReport): void => {
    for (const node of active) node.classList.remove("source__line--active");
    active = [];
    const from = fn.range.start.line;
    const to = fn.range.end.line;
    for (let line = from; line <= to; line++) {
      const node = lineEls[line - 1];
      if (node) {
        node.classList.add("source__line--active");
        active.push(node);
      }
    }
    lineEls[from - 1]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  return { element: section(t().detail.source, pre), highlight };
}

function functionsTable(
  file: FileReport,
  onSelect: (fn: FunctionReport) => void,
): HTMLTableElement {
  const rows: Cell[][] = file.functions
    .slice()
    .sort((a, b) => b.cognitive - a.cognitive || b.cyclomatic - a.cyclomatic)
    .map((fn) => [
      { content: el("span", { class: complexityClass(fn.cyclomatic), text: String(fn.cyclomatic) }), value: fn.cyclomatic },
      { content: el("span", { class: complexityClass(fn.cognitive), text: String(fn.cognitive) }), value: fn.cognitive },
      { content: fn.maxNesting, value: fn.maxNesting },
      { content: fn.loc, value: fn.loc },
      { content: fn.params, value: fn.params },
      { content: fn.maintainability.toFixed(0), value: fn.maintainability },
      { content: el("span", { class: "link", text: fn.name, onClick: () => onSelect(fn) }) },
      { content: fn.range.start.line, value: fn.range.start.line },
    ]);

  return dataTable(
    [
      { header: t().detail.table.cyclomatic, align: "right" },
      { header: t().detail.table.cognitive, align: "right" },
      { header: t().detail.table.nesting, align: "right" },
      { header: t().detail.table.loc, align: "right" },
      { header: t().detail.table.params, align: "right" },
      { header: t().detail.table.maintainability, align: "right" },
      { header: t().detail.table.function },
      { header: t().detail.table.line, align: "right" },
    ],
    rows,
  );
}

function complexityClass(value: number): string {
  if (value >= 20) return "bad";
  if (value >= 10) return "warn";
  return "";
}
