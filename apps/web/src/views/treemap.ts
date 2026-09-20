import type { AnalysisReport } from "@meowanalyze/core";
import { complexityColor, nestedTreemapChart, type TreeNode } from "../charts.js";
import { el } from "../dom.js";
import { t } from "../i18n.js";
import { dataTable, type Cell } from "../table.js";
import { allFunctions } from "./dashboard.js";

export interface TreemapHandlers {
  onOpenFile: (path: string) => void;
}

export function renderTreemap(
  root: HTMLElement,
  report: AnalysisReport,
  handlers: TreemapHandlers,
): void {
  root.replaceChildren();

  root.append(
    el(
      "header",
      { class: "page__head" },
      el(
        "div",
        {},
        el("h1", { class: "page__title", text: t().pages.treemap }),
        el("p", { class: "page__meta", text: t().treemap.hint }),
      ),
    ),
    el(
      "div",
      { class: "treemap-wrap" },
      nestedTreemapChart(buildTree(report), {
        width: 1000,
        height: 620,
        onSelect: handlers.onOpenFile,
      }),
    ),
    topFunctions(report, handlers),
  );
}

function topFunctions(report: AnalysisReport, handlers: TreemapHandlers): HTMLElement {
  const s = t().dashboard;
  const top = allFunctions(report)
    .sort((a, b) => b.fn.cognitive - a.fn.cognitive || b.fn.cyclomatic - a.fn.cyclomatic)
    .slice(0, 12);

  const rows: Cell[][] = top.map(({ file, fn }) => [
    {
      content: el("span", {
        class: "link",
        text: fn.name,
        onClick: () => handlers.onOpenFile(file),
      }),
    },
    { content: file },
    { content: el("span", { class: complexityClass(fn.cyclomatic), text: String(fn.cyclomatic) }), value: fn.cyclomatic },
    { content: el("span", { class: complexityClass(fn.cognitive), text: String(fn.cognitive) }), value: fn.cognitive },
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

/** Build a folder tree whose leaves are files, sized by code lines. */
export function buildTree(report: AnalysisReport): TreeNode {
  const root: TreeNode = { name: "", value: 0, children: [] };

  for (const file of report.files) {
    const parts = file.path.split("/");
    let node = root;
    parts.forEach((part, index) => {
      const isLeaf = index === parts.length - 1;
      node.children ??= [];
      let child = node.children.find((candidate) => candidate.name === part);
      if (!child) {
        child = { name: part, value: 0, children: isLeaf ? undefined : [] };
        node.children.push(child);
      }
      if (isLeaf) {
        child.value = Math.max(1, file.loc.code);
        child.key = file.path;
        child.color = complexityColor(file.metrics.cognitive.max);
      }
      node = child;
    });
  }

  const aggregate = (node: TreeNode): number => {
    if (!node.children || node.children.length === 0) return node.value;
    node.value = node.children.reduce((sum, child) => sum + aggregate(child), 0);
    return node.value;
  };
  aggregate(root);

  return root;
}
