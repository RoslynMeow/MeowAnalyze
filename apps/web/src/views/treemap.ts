import type { AnalysisReport } from "@meowanalyze/core";
import { complexityColor, nestedTreemapChart, type TreeNode } from "../charts.js";
import { el } from "../dom.js";

export interface TreemapHandlers {
  onOpenFile: (path: string) => void;
}

/**
 * Full-bleed file map: a nested, SpaceSniffer-style treemap sized by code
 * lines. No chrome — just the map, filling the page.
 */
export function renderTreemap(
  root: HTMLElement,
  report: AnalysisReport,
  handlers: TreemapHandlers,
): void {
  root.replaceChildren();

  const wrap = el("div", { class: "treemap-wrap" });
  root.append(wrap);

  const tree = buildTree(report);
  let lastWidth = 0;
  let lastHeight = 0;
  let drawn = false;

  const draw = (): void => {
    const rect = wrap.getBoundingClientRect();
    let width = Math.round(rect.width);
    let height = Math.round(rect.height);
    if (width < 2 || height < 2) {
      if (drawn) return; // keep the current render; wait for a real layout
      width = 1000;
      height = 620;
    }
    if (drawn && width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    drawn = true;
    wrap.replaceChildren(
      nestedTreemapChart(tree, { width, height, onSelect: handlers.onOpenFile }),
    );
  };

  draw();

  // Re-measure once the browser has laid the page out, and on every resize.
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(draw);
  }
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
  }
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
