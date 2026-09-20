/**
 * Dependency-free SVG charts. Layout math is split into pure functions so it
 * can be unit-tested without a DOM.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

type Attrs = Record<string, string | number>;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function withTitle<T extends SVGElement>(node: T, text: string): T {
  const title = svg("title");
  title.textContent = text;
  node.append(title);
  return node;
}

/** Stagger entrance animations via a CSS custom property. */
function withDelay(node: SVGElement, index: number, step = 35): void {
  node.setAttribute("style", `--delay:${index * step}ms`);
}

export const PALETTE: readonly string[] = [
  "#58a6ff",
  "#3fb950",
  "#d29922",
  "#f85149",
  "#bc8cff",
  "#39c5cf",
  "#ff7b72",
  "#a5d6ff",
];

export function complexityColor(value: number): string {
  if (value >= 20) return "#f85149";
  if (value >= 10) return "#d29922";
  return "#3fb950";
}

export function maintainabilityColor(value: number): string {
  if (value < 40) return "#f85149";
  if (value < 65) return "#d29922";
  return "#3fb950";
}

/* ------------------------------------------------------------------ */
/* Buckets (for pie charts)                                            */
/* ------------------------------------------------------------------ */

export interface BucketRange {
  upTo: number;
  label: string;
  color: string;
}

/** Count values into ranges and return non-empty donut segments. */
export function bucketize(
  values: readonly number[],
  ranges: readonly BucketRange[],
): DonutSegment[] {
  const counts = ranges.map((range) => ({
    label: range.label,
    value: 0,
    color: range.color,
  }));
  for (const value of values) {
    const index = ranges.findIndex((range) => value <= range.upTo);
    const target = counts[index === -1 ? ranges.length - 1 : index];
    if (target) target.value++;
  }
  return counts.filter((segment) => segment.value > 0);
}

/* ------------------------------------------------------------------ */
/* Nested treemap                                                      */
/* ------------------------------------------------------------------ */

export interface TreeNode {
  name: string;
  value: number;
  color?: string;
  key?: string;
  children?: TreeNode[];
}

export interface TreemapBox {
  node: TreeNode;
  rect: Rect;
  depth: number;
  leaf: boolean;
}

/** Squarified, recursively nested treemap layout (folders contain files). */
export function nestedTreemapLayout(
  root: TreeNode,
  bounds: Rect,
  options: { padding?: number; maxDepth?: number } = {},
): TreemapBox[] {
  const padding = options.padding ?? 6;
  const maxDepth = options.maxDepth ?? 8;
  const boxes: TreemapBox[] = [];

  const place = (node: TreeNode, rect: Rect, depth: number): void => {
    const children = node.children?.filter((child) => child.value > 0);
    const canNest =
      children !== undefined &&
      children.length > 0 &&
      depth < maxDepth &&
      rect.w > 46 &&
      rect.h > 34;

    if (!canNest || children === undefined) {
      boxes.push({ node, rect, depth, leaf: true });
      return;
    }

    boxes.push({ node, rect, depth, leaf: false });
    const sorted = [...children].sort((a, b) => b.value - a.value);
    const rects = squarify(sorted.map((child) => child.value), rect);
    sorted.forEach((child, index) => {
      const childRect = rects[index];
      if (!childRect) return;
      const inset = Math.min(padding, childRect.w / 4, childRect.h / 4);
      place(
        child,
        {
          x: childRect.x + inset / 2,
          y: childRect.y + inset / 2,
          w: Math.max(0, childRect.w - inset),
          h: Math.max(0, childRect.h - inset),
        },
        depth + 1,
      );
    });
  };

  place(root, bounds, 0);
  return boxes;
}

export function nestedTreemapChart(
  root: TreeNode,
  options: { width?: number; height?: number; onSelect?: (key: string) => void } = {},
): SVGSVGElement {
  const width = options.width ?? 900;
  const height = options.height ?? 520;
  const svgRoot = svg("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "chart chart--treemap",
    preserveAspectRatio: "xMidYMid meet",
  });

  const boxes = nestedTreemapLayout(root, { x: 0, y: 0, w: width, h: height });
  boxes.forEach((box, index) => {
    const isLeaf = box.leaf;
    const rect = svg("rect", {
      x: box.rect.x + 1,
      y: box.rect.y + 1,
      width: Math.max(0, box.rect.w - 2),
      height: Math.max(0, box.rect.h - 2),
      rx: isLeaf ? 4 : 6,
      fill: isLeaf ? box.node.color ?? "#58a6ff" : "transparent",
      class: isLeaf ? "chart__cell chart__anim-pop" : "chart__folder",
      ...(isLeaf ? { "data-key": box.node.key ?? box.node.name } : {}),
    });
    withTitle(
      rect,
      isLeaf
        ? `${box.node.name}: ${box.node.value} code lines`
        : `${box.node.name || "root"} (${box.node.value} lines)`,
    );
    if (isLeaf) withDelay(rect, index, 12);
    svgRoot.append(rect);

    if (box.rect.w > 54 && box.rect.h > 18) {
      const label = svg("text", {
        x: box.rect.x + 8,
        y: box.rect.y + 17,
        class: isLeaf ? "chart__cell-label" : "chart__folder-label",
      });
      label.textContent = truncate(box.node.name, Math.floor(box.rect.w / 8));
      svgRoot.append(label);
    }
  });

  if (options.onSelect) {
    svgRoot.addEventListener("click", (event) => {
      const key = (event.target as SVGElement).closest("[data-key]")?.getAttribute("data-key");
      if (key) options.onSelect?.(key);
    });
  }

  return svgRoot;
}

/* ------------------------------------------------------------------ */
/* Gauge                                                               */
/* ------------------------------------------------------------------ */

export function gaugeChart(
  value: number,
  options: { size?: number; label?: string; color?: string } = {},
): SVGSVGElement {
  const size = options.size ?? 160;
  const thickness = 14;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);
  const color = options.color ?? maintainabilityColor(clamped);

  const root = svg("svg", {
    viewBox: `0 0 ${size} ${size}`,
    class: "chart chart--gauge",
    preserveAspectRatio: "xMidYMid meet",
  });

  root.append(
    svg("circle", {
      cx: size / 2,
      cy: size / 2,
      r: radius,
      fill: "none",
      class: "chart__ring",
      "stroke-width": thickness,
    }),
  );

  const arc = svg("circle", {
    cx: size / 2,
    cy: size / 2,
    r: radius,
    fill: "none",
    stroke: color,
    "stroke-width": thickness,
    "stroke-linecap": "round",
    "stroke-dasharray": `${circumference} ${circumference}`,
    transform: `rotate(-90 ${size / 2} ${size / 2})`,
    class: "gauge__value",
  });
  arc.setAttribute("style", `--circ:${circumference};--offset:${offset}`);
  root.append(arc);

  const valueText = svg("text", {
    x: size / 2,
    y: size / 2,
    class: "chart__center-value",
    "text-anchor": "middle",
  });
  valueText.textContent = clamped.toFixed(0);
  root.append(valueText);

  if (options.label) {
    const label = svg("text", {
      x: size / 2,
      y: size / 2 + 20,
      class: "chart__center-label",
      "text-anchor": "middle",
    });
    label.textContent = options.label;
    root.append(label);
  }

  return root;
}

/* ------------------------------------------------------------------ */
/* Histogram                                                           */
/* ------------------------------------------------------------------ */

export interface HistogramBin {
  label: string;
  from: number;
  to: number;
  count: number;
}

/** Bucket integer samples into value bins, grouping the tail into `maxBins`. */
export function computeHistogram(
  values: readonly number[],
  maxBins = 12,
): HistogramBin[] {
  if (values.length === 0) return [];

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  min = Math.floor(min);
  max = Math.ceil(max);

  if (max - min + 1 <= maxBins) {
    const bins: HistogramBin[] = [];
    for (let value = min; value <= max; value++) {
      bins.push({ label: String(value), from: value, to: value, count: 0 });
    }
    for (const value of values) {
      const index = clamp(Math.floor(value) - min, 0, bins.length - 1);
      const bin = bins[index];
      if (bin) bin.count++;
    }
    return bins;
  }

  const width = Math.ceil((max - min + 1) / maxBins);
  const bins: HistogramBin[] = [];
  for (let i = 0; i < maxBins; i++) {
    const from = min + i * width;
    const to = from + width - 1;
    bins.push({ label: `${from}–${to}`, from, to, count: 0 });
  }
  for (const value of values) {
    const index = clamp(Math.floor((value - min) / width), 0, bins.length - 1);
    const bin = bins[index];
    if (bin) bin.count++;
  }
  return bins;
}

export function histogramChart(
  values: readonly number[],
  options: { width?: number; height?: number } = {},
): SVGSVGElement {
  const width = options.width ?? 560;
  const height = options.height ?? 240;
  const pad = { top: 16, right: 12, bottom: 30, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const root = svg("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "chart",
    preserveAspectRatio: "xMidYMid meet",
  });

  const bins = computeHistogram(values);
  if (bins.length === 0) {
    root.append(svg("text", { x: width / 2, y: height / 2, class: "chart__empty", "text-anchor": "middle" }));
    const text = root.lastChild as SVGTextElement;
    text.textContent = "no data";
    return root;
  }

  const maxCount = Math.max(...bins.map((bin) => bin.count), 1);
  const slot = plotW / bins.length;
  const barW = Math.max(2, slot * 0.68);

  // horizontal gridlines
  for (let g = 0; g <= 4; g++) {
    const y = pad.top + (plotH * g) / 4;
    root.append(
      svg("line", {
        x1: pad.left,
        y1: y,
        x2: width - pad.right,
        y2: y,
        class: "chart__grid",
      }),
    );
    const tick = svg("text", {
      x: pad.left - 6,
      y: y + 4,
      class: "chart__tick",
      "text-anchor": "end",
    });
    tick.textContent = String(Math.round((maxCount * (4 - g)) / 4));
    root.append(tick);
  }

  bins.forEach((bin, index) => {
    const barH = (bin.count / maxCount) * plotH;
    const x = pad.left + slot * index + (slot - barW) / 2;
    const y = pad.top + plotH - barH;
    const rect = withTitle(
      svg("rect", {
        x,
        y,
        width: barW,
        height: barH,
        rx: 3,
        fill: complexityColor(bin.to),
        class: "chart__bar chart__anim-grow-y",
      }),
      `${bin.label}: ${bin.count} function(s)`,
    );
    withDelay(rect, index);
    root.append(rect);

    if (bins.length <= 14 || index % 2 === 0) {
      const label = svg("text", {
        x: pad.left + slot * index + slot / 2,
        y: height - pad.bottom + 16,
        class: "chart__tick",
        "text-anchor": "middle",
      });
      label.textContent = bin.label;
      root.append(label);
    }
  });

  root.append(
    svg("line", {
      x1: pad.left,
      y1: pad.top + plotH,
      x2: width - pad.right,
      y2: pad.top + plotH,
      class: "chart__axis",
    }),
  );

  return root;
}

/* ------------------------------------------------------------------ */
/* Horizontal bars                                                     */
/* ------------------------------------------------------------------ */

export interface BarItem {
  label: string;
  value: number;
  sub?: string;
  color?: string;
  key?: string;
}

export function barList(
  items: readonly BarItem[],
  options: { width?: number; rowHeight?: number } = {},
): SVGSVGElement {
  const width = options.width ?? 560;
  const rowHeight = options.rowHeight ?? 26;
  const labelW = 150;
  const valueW = 46;
  const height = Math.max(rowHeight, items.length * rowHeight) + 8;

  const root = svg("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "chart",
    preserveAspectRatio: "xMidYMid meet",
  });

  const max = Math.max(...items.map((item) => item.value), 1);
  const trackW = width - labelW - valueW - 12;

  items.forEach((item, index) => {
    const y = 4 + index * rowHeight;
    const barW = (item.value / max) * trackW;

    const label = svg("text", {
      x: 0,
      y: y + rowHeight / 2 + 4,
      class: "chart__label",
    });
    label.textContent = truncate(item.label, 22);
    root.append(withTitle(label, item.label));

    root.append(
      svg("rect", {
        x: labelW,
        y: y + 4,
        width: trackW,
        height: rowHeight - 12,
        rx: 4,
        class: "chart__track",
      }),
    );

    const bar = svg("rect", {
      x: labelW,
      y: y + 4,
      width: Math.max(2, barW),
      height: rowHeight - 12,
      rx: 4,
      fill: item.color ?? PALETTE[index % PALETTE.length] ?? "#58a6ff",
      class: item.key
        ? "chart__bar chart__bar--clickable chart__anim-grow-x"
        : "chart__bar chart__anim-grow-x",
    });
    if (item.key) bar.setAttribute("data-key", item.key);
    withDelay(bar, index);
    root.append(
      withTitle(bar, `${item.label}: ${item.value}${item.sub ? ` (${item.sub})` : ""}`),
    );

    const value = svg("text", {
      x: width,
      y: y + rowHeight / 2 + 4,
      class: "chart__value",
      "text-anchor": "end",
    });
    value.textContent = String(item.value);
    root.append(value);
  });

  return root;
}

/* ------------------------------------------------------------------ */
/* Donut                                                               */
/* ------------------------------------------------------------------ */

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function donutChart(
  segments: readonly DonutSegment[],
  options: { size?: number; thickness?: number; centerLabel?: string; centerValue?: string } = {},
): SVGSVGElement {
  const size = options.size ?? 200;
  const thickness = options.thickness ?? 26;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  const root = svg("svg", {
    viewBox: `0 0 ${size} ${size}`,
    class: "chart chart--donut chart__anim-fade",
    preserveAspectRatio: "xMidYMid meet",
  });

  root.append(
    svg("circle", {
      cx: size / 2,
      cy: size / 2,
      r: radius,
      fill: "none",
      class: "chart__ring",
      "stroke-width": thickness,
    }),
  );

  let offset = 0;
  for (const segment of segments) {
    if (total === 0 || segment.value === 0) continue;
    const length = (segment.value / total) * circumference;
    const arc = withTitle(
      svg("circle", {
        cx: size / 2,
        cy: size / 2,
        r: radius,
        fill: "none",
        stroke: segment.color,
        "stroke-width": thickness,
        "stroke-dasharray": `${length} ${circumference - length}`,
        "stroke-dashoffset": -offset,
        transform: `rotate(-90 ${size / 2} ${size / 2})`,
        class: "chart__arc",
      }),
      `${segment.label}: ${segment.value} (${Math.round((segment.value / total) * 100)}%)`,
    );
    root.append(arc);
    offset += length;
  }

  if (options.centerValue) {
    const value = svg("text", {
      x: size / 2,
      y: size / 2,
      class: "chart__center-value",
      "text-anchor": "middle",
    });
    value.textContent = options.centerValue;
    root.append(value);
  }
  if (options.centerLabel) {
    const label = svg("text", {
      x: size / 2,
      y: size / 2 + 20,
      class: "chart__center-label",
      "text-anchor": "middle",
    });
    label.textContent = options.centerLabel;
    root.append(label);
  }

  return root;
}

/* ------------------------------------------------------------------ */
/* Treemap (squarified)                                                */
/* ------------------------------------------------------------------ */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TreemapItem {
  label: string;
  value: number;
  color?: string;
  key?: string;
}

export function treemapChart(
  items: readonly TreemapItem[],
  options: { width?: number; height?: number } = {},
): SVGSVGElement {
  const width = options.width ?? 560;
  const height = options.height ?? 260;
  const root = svg("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "chart",
    preserveAspectRatio: "xMidYMid meet",
  });

  const sorted = [...items].filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    const text = svg("text", { x: width / 2, y: height / 2, "text-anchor": "middle", class: "chart__empty" });
    text.textContent = "no data";
    root.append(text);
    return root;
  }

  const rects = squarify(
    sorted.map((item) => item.value),
    { x: 0, y: 0, w: width, h: height },
  );

  sorted.forEach((item, index) => {
    const rect = rects[index];
    if (!rect) return;
    const node = withTitle(
      svg("rect", {
        x: rect.x + 1,
        y: rect.y + 1,
        width: Math.max(0, rect.w - 2),
        height: Math.max(0, rect.h - 2),
        rx: 3,
        fill: item.color ?? PALETTE[index % PALETTE.length] ?? "#58a6ff",
        class: "chart__cell chart__anim-pop",
      }),
      `${item.label}: ${item.value} code lines`,
    );
    if (item.key) node.setAttribute("data-key", item.key);
    withDelay(node, index, 20);
    root.append(node);

    if (rect.w > 60 && rect.h > 20) {
      const label = svg("text", {
        x: rect.x + 8,
        y: rect.y + 18,
        class: "chart__cell-label",
      });
      label.textContent = truncate(item.label, Math.floor(rect.w / 8));
      root.append(label);
    }
  });

  return root;
}

/** Squarified treemap layout. Returns one rect per value, in the same order. */
export function squarify(values: readonly number[], bounds: Rect): Rect[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || values.length === 0) return [];

  const scale = (bounds.w * bounds.h) / total;
  const areas = values.map((value) => value * scale);
  const result: Rect[] = [];
  layoutRow(areas, [], bounds, result);
  return result;
}

function layoutRow(
  remaining: number[],
  row: number[],
  rect: Rect,
  out: Rect[],
): void {
  if (remaining.length === 0) {
    if (row.length > 0) placeRow(row, rect, out);
    return;
  }

  const candidate = remaining[0];
  if (candidate === undefined) return;
  const side = Math.min(rect.w, rect.h);

  if (row.length === 0 || worst([...row, candidate], side) <= worst(row, side)) {
    layoutRow(remaining.slice(1), [...row, candidate], rect, out);
    return;
  }

  const next = placeRow(row, rect, out);
  layoutRow(remaining, [], next, out);
}

function placeRow(row: number[], rect: Rect, out: Rect[]): Rect {
  const side = Math.min(rect.w, rect.h);
  const total = row.reduce((sum, value) => sum + value, 0);
  const thickness = side === 0 ? 0 : total / side;
  const vertical = rect.w >= rect.h;

  let offset = 0;
  for (const area of row) {
    const length = thickness === 0 ? 0 : area / thickness;
    out.push(
      vertical
        ? { x: rect.x, y: rect.y + offset, w: thickness, h: length }
        : { x: rect.x + offset, y: rect.y, w: length, h: thickness },
    );
    offset += length;
  }

  return vertical
    ? { x: rect.x + thickness, y: rect.y, w: rect.w - thickness, h: rect.h }
    : { x: rect.x, y: rect.y + thickness, w: rect.w, h: rect.h - thickness };
}

function worst(row: number[], side: number): number {
  if (row.length === 0) return Number.POSITIVE_INFINITY;
  const sum = row.reduce((acc, value) => acc + value, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  if (sum === 0 || min === 0 || side === 0) return Number.POSITIVE_INFINITY;
  const s2 = sum * sum;
  const w2 = side * side;
  return Math.max((w2 * max) / s2, s2 / (w2 * min));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function truncate(text: string, max: number): string {
  if (max <= 1) return text;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
