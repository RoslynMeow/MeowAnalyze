import type { FileReport, FunctionReport } from "@meowanalyze/core";
import { complexityColor, gaugeChart } from "../charts.js";
import { button, el } from "../dom.js";
import { t } from "../i18n.js";
import { dataTable, type Cell } from "../table.js";

export interface DetailHandlers {
  onBack: () => void;
}

const MAX_SOURCE_LINES = 5000;

export function renderDetail(
  root: HTMLElement,
  file: FileReport,
  source: string | undefined,
  handlers: DetailHandlers,
): void {
  root.replaceChildren();

  const view = el("div", { class: "view detail" });
  view.append(header(file, handlers), kpis(file));

  const sourcePanel = source ? buildSource(source) : undefined;
  if (sourcePanel) {
    view.append(sourcePanel.element);
  }

  view.append(
    card(
      t().detail.functionsTitle(file.functions.length),
      sourcePanel
        ? functionsTable(file, (fn) => sourcePanel.highlight(fn))
        : functionsTable(file, () => undefined),
    ),
  );

  root.append(view);
}

function card(title: string, ...children: Array<Node | string | null>): HTMLElement {
  return el("section", { class: "card" }, el("h2", { text: title }), ...children);
}

function header(file: FileReport, handlers: DetailHandlers): HTMLElement {
  return el(
    "header",
    { class: "detail__header" },
    button(t().common.back, handlers.onBack),
    el(
      "div",
      {},
      el("h1", { class: "detail__title", text: file.path }),
      el(
        "div",
        { class: "detail__badges" },
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
    ),
  );
}

function kpis(file: FileReport): HTMLElement {
  const s = t().detail.kpi;
  const maxCyclo = file.metrics.cyclomatic.max;
  const maxCognitive = file.metrics.cognitive.max;
  return el(
    "div",
    { class: "kpis" },
    el("div", { class: "kpi kpi--gauge" }, gaugeChart(file.maintainability, { size: 120, label: "MI" })),
    kpi(s.functions, file.functions.length),
    kpi(s.maxCyclomatic, maxCyclo, complexityColor(maxCyclo)),
    kpi(s.maxCognitive, maxCognitive, complexityColor(maxCognitive)),
    kpi(s.maxNesting, file.metrics.nesting.max),
    kpi(s.codeLines, file.loc.code),
    kpi(
      s.violations,
      file.violations.length,
      file.violations.length > 0 ? "#d29922" : undefined,
    ),
  );
}

function kpi(label: string, value: number, color?: string): HTMLElement {
  const valueNode = el("div", { class: "kpi__value", text: String(value) });
  if (color) valueNode.style.color = color;
  return el("div", { class: "kpi" }, valueNode, el("div", { class: "kpi__label", text: label }));
}

interface SourcePanel {
  element: HTMLElement;
  highlight: (fn: FunctionReport) => void;
}

function buildSource(source: string): SourcePanel {
  const lines = source.split(/\r?\n/);
  const pre = el("pre", { class: "source" });

  if (lines.length > MAX_SOURCE_LINES) {
    pre.append(
      el("div", {
        class: "source__too-large",
        text: t().detail.sourceTooLarge(lines.length),
      }),
    );
    return { element: wrapSource(pre), highlight: () => undefined };
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
  const clear = (): void => {
    for (const node of active) node.classList.remove("source__line--active");
    active = [];
  };
  const highlight = (fn: FunctionReport): void => {
    clear();
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

  return { element: wrapSource(pre), highlight };
}

function wrapSource(pre: HTMLElement): HTMLElement {
  return el(
    "section",
    { class: "card source-card" },
    el("h2", { text: t().detail.source }),
    pre,
  );
}

function functionsTable(
  file: FileReport,
  onSelect: (fn: FunctionReport) => void,
): HTMLTableElement {
  const rows: Cell[][] = file.functions
    .slice()
    .sort((a, b) => b.cognitive - a.cognitive || b.cyclomatic - a.cyclomatic)
    .map((fn) => [
      {
        content: el("span", {
          class: complexityClass(fn.cyclomatic),
          text: String(fn.cyclomatic),
        }),
        value: fn.cyclomatic,
      },
      {
        content: el("span", {
          class: complexityClass(fn.cognitive),
          text: String(fn.cognitive),
        }),
        value: fn.cognitive,
      },
      { content: fn.maxNesting, value: fn.maxNesting },
      { content: fn.loc, value: fn.loc },
      { content: fn.params, value: fn.params },
      { content: fn.maintainability.toFixed(0), value: fn.maintainability },
      {
        content: el("span", {
          class: "link",
          text: fn.name,
          onClick: () => onSelect(fn),
        }),
      },
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
