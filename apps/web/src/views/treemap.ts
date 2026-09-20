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

const MAX_CHILDREN = 48;
const MIN_AREA_RATIO = 0.0008; // ~22x22px on a 1000x600 map
const MAX_FLOOR_SHARE = 0.35; // floors may claim at most this share of the map

/**
 * Build a folder tree whose leaves are files. Cell area uses √code-lines so the
 * size range stays readable; the real line count is kept for tooltips.
 */
export function buildTree(report: AnalysisReport): TreeNode {
  const root: TreeNode = { name: "", value: 0, children: [] };

  for (const file of report.files) {
    const parts = file.path.split("/");
    const lines = Math.max(1, file.loc.code);
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
        child.value = Math.sqrt(lines);
        child.lines = lines;
        child.key = file.path;
        child.color = complexityColor(file.metrics.cognitive.max);
      }
      node = child;
    });
  }

  aggregate(root);
  pruneLargeFolders(root);
  aggregate(root);
  applyMinimumArea(root);
  aggregate(root);

  return root;
}

function aggregate(node: TreeNode): number {
  if (!node.children || node.children.length === 0) return node.value;
  node.value = 0;
  node.lines = 0;
  for (const child of node.children) {
    aggregate(child);
    node.value += child.value;
    node.lines = (node.lines ?? 0) + (child.lines ?? 0);
  }
  return node.value;
}

/** Fold the smallest entries of crowded folders into a single "…" cell. */
function pruneLargeFolders(node: TreeNode): void {
  if (!node.children || node.children.length === 0) return;
  if (node.children.length > MAX_CHILDREN) {
    const sorted = [...node.children].sort((a, b) => b.value - a.value);
    const keep = sorted.slice(0, MAX_CHILDREN - 1);
    const rest = sorted.slice(MAX_CHILDREN - 1);
    keep.push({
      name: "…",
      value: rest.reduce((sum, child) => sum + child.value, 0),
      lines: rest.reduce((sum, child) => sum + (child.lines ?? 0), 0),
      color: "#484f58",
    });
    node.children = keep;
  }
  for (const child of node.children) pruneLargeFolders(child);
}

/** Floor tiny files so no cell becomes invisible in large projects. */
function applyMinimumArea(root: TreeNode): void {
  const leaves: TreeNode[] = [];
  collectLeaves(root, leaves);
  if (leaves.length <= 1) return;

  const total = leaves.reduce((sum, leaf) => sum + leaf.value, 0);
  if (total <= 0) return;

  const floor = Math.max(
    1,
    Math.min(total * MIN_AREA_RATIO, (total * MAX_FLOOR_SHARE) / leaves.length),
  );
  for (const leaf of leaves) {
    if (leaf.value < floor) leaf.value = floor;
  }
}

function collectLeaves(node: TreeNode, out: TreeNode[]): void {
  if (!node.children || node.children.length === 0) {
    out.push(node);
    return;
  }
  for (const child of node.children) collectLeaves(child, out);
}
