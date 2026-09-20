import type { BucketRange, DonutSegment } from "./charts.js";
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
  /** Bucket ranges, so a bar selection can be matched back to items. */
  ranges?: readonly BucketRange[];
  /** Segment/bar to apply as the initial filter. */
  selected?: string;
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

function rangeIndexOf(value: number, ranges: readonly BucketRange[]): number {
  const index = ranges.findIndex((range) => value <= range.upTo);
  return index === -1 ? ranges.length - 1 : index;
}

/** Items that belong to the clicked chart segment / bar. */
function itemsForLabel(dd: Drilldown, label: string): DrillItem[] {
  if (dd.ranges) {
    const index = dd.ranges.findIndex((range) => range.label === label);
    if (index >= 0) {
      const ranges = dd.ranges;
      return dd.items.filter((item) => rangeIndexOf(item.value, ranges) === index);
    }
  }
  return dd.items.filter((item) => item.category === label);
}

export function openDrilldown(dd: Drilldown, handlers: DrilldownHandlers): void {
  closeDrilldown();

  let selected = dd.selected;

  const chartHost = el("div", { class: "drawer__chart" });
  const filterBar = el("div", { class: "drawer__filter" });
  const list = el("div", { class: "drawer__list" });
  const hint = el("p", { class: "drawer__hint" });

  const refresh = (): void => {
    const items = (selected ? itemsForLabel(dd, selected) : [...dd.items])
      .sort((a, b) => b.value - a.value)
      .slice(0, 200);

    list.replaceChildren(
      ...items.map((item) =>
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
      ),
    );

    hint.textContent = String(items.length);

    if (selected) {
      const clear = el("button", {
        class: "drawer__filter-clear",
        text: "✕",
        onClick: () => {
          selected = undefined;
          refresh();
        },
      });
      clear.type = "button";
      filterBar.replaceChildren(
        el("span", { class: "drawer__filter-chip", text: selected }),
        clear,
      );
      filterBar.hidden = false;
    } else {
      filterBar.replaceChildren();
      filterBar.hidden = true;
    }
  };

  const closeBtn = el("button", { class: "drawer__close", text: "✕", onClick: closeDrilldown });
  closeBtn.type = "button";

  const drawer = el(
    "aside",
    { class: "drawer" },
    el("header", { class: "drawer__head" }, el("h2", { class: "drawer__title", text: dd.title }), closeBtn),
    chartHost,
    filterBar,
    hint,
    list,
  );

  overlay = el("div", { class: "drawer-overlay" }, drawer);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeDrilldown();
  });
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);

  refresh();

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => overlay?.classList.add("drawer-overlay--open"));
  } else {
    overlay.classList.add("drawer-overlay--open");
  }

  const onSelect = (name: string): void => {
    if (itemsForLabel(dd, name).length === 0) return;
    selected = selected === name ? undefined : name;
    refresh();
  };

  if (dd.segments.length === 0) {
    chartHost.hidden = true;
    return;
  }

  void (async () => {
    chartInstance =
      dd.chart === "bar"
        ? await renderBar(chartHost, dd.segments, onSelect)
        : await renderDonut(chartHost, dd.segments, dd.centerValue, dd.centerLabel, onSelect);
  })();
}
