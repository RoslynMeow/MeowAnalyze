import type { DonutSegment } from "./charts.js";
import { el } from "./dom.js";
import { disposeChart, renderBar, renderDonut } from "./echarts.js";

export interface DrillItem {
  label: string;
  file: string;
  line?: number;
  endLine?: number;
  value: number;
  /** Used to filter items when a non-bucketed slice is clicked. */
  category?: string;
}

export interface Drilldown {
  title: string;
  chart: "donut" | "bar";
  segments: DonutSegment[];
  items: DrillItem[];
  centerValue?: string;
  centerLabel?: string;
}

export interface DrilldownHandlers {
  onJump: (item: DrillItem) => void;
}

let overlay: HTMLElement | undefined;
let chartInstance: import("echarts/core").EChartsType | undefined;

function onKey(event: KeyboardEvent): void {
  if (event.key === "Escape") closeDrilldown();
}

export function closeDrilldown(): void {
  disposeChart(chartInstance);
  chartInstance = undefined;
  document.removeEventListener("keydown", onKey);
  overlay?.remove();
  overlay = undefined;
}

export function openDrilldown(dd: Drilldown, handlers: DrilldownHandlers): void {
  closeDrilldown();

  const chartHost = el("div", { class: "drawer__chart" });
  const list = el("div", { class: "drawer__list" });

  const items = [...dd.items].sort((a, b) => b.value - a.value).slice(0, 200);
  for (const item of items) {
    list.append(
      el(
        "button",
        {
          class: "drawer__item",
          onClick: () => {
            handlers.onJump(item);
            closeDrilldown();
          },
        },
        el("span", { class: "drawer__item-label", text: item.label }),
        el("span", {
          class: "drawer__item-file",
          text: `${item.file}${item.line ? `:${item.line}` : ""}`,
        }),
        el("span", { class: "drawer__item-value", text: String(item.value) }),
      ),
    );
  }

  const closeBtn = el("button", { class: "drawer__close", text: "✕", onClick: closeDrilldown });
  closeBtn.type = "button";

  const drawer = el(
    "aside",
    { class: "drawer" },
    el("header", { class: "drawer__head" }, el("h2", { class: "drawer__title", text: dd.title }), closeBtn),
    chartHost,
    el("p", { class: "drawer__hint", text: `${items.length}` }),
    list,
  );

  overlay = el("div", { class: "drawer-overlay" }, drawer);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeDrilldown();
  });
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => overlay?.classList.add("drawer-overlay--open"));
  } else {
    overlay.classList.add("drawer-overlay--open");
  }

  void (async () => {
    chartInstance =
      dd.chart === "bar"
        ? await renderBar(chartHost, dd.segments)
        : await renderDonut(chartHost, dd.segments, dd.centerValue, dd.centerLabel);
  })();
}
