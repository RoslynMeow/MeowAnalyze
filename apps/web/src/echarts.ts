import type { DonutSegment } from "./charts.js";

type EChartsType = import("echarts/core").EChartsType;
type EChartsModule = typeof import("echarts/core");

let loader: Promise<EChartsModule | undefined> | undefined;
const instances = new Set<EChartsType>();

function canvasSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return (
      typeof canvas.getContext === "function" && canvas.getContext("2d") !== null
    );
  } catch {
    return false;
  }
}

/** Lazily load ECharts (code-split) with only the pieces we use. */
async function loadEcharts(): Promise<EChartsModule | undefined> {
  if (!canvasSupported()) return undefined;
  if (!loader) {
    loader = (async () => {
      const [core, charts, components, renderers] = await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("echarts/renderers"),
      ]);
      core.use([
        charts.PieChart,
        charts.BarChart,
        charts.GaugeChart,
        components.TooltipComponent,
        components.LegendComponent,
        components.GridComponent,
        renderers.CanvasRenderer,
      ]);
      return core;
    })();
  }
  return loader;
}

export function disposeCharts(): void {
  for (const chart of instances) chart.dispose();
  instances.clear();
}

export function disposeChart(chart: EChartsType | undefined): void {
  if (!chart) return;
  chart.dispose();
  instances.delete(chart);
}

function cssVar(name: string): string {
  if (typeof getComputedStyle !== "function") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function baseTextOptions(): { text: string; muted: string; border: string; card: string; grid: string } {
  return {
    text: cssVar("--text") || "#e6edf3",
    muted: cssVar("--muted") || "#8b949e",
    border: cssVar("--border") || "#30363d",
    card: cssVar("--bg-card") || "#161b22",
    grid: cssVar("--grid") || "#21262d",
  };
}

function tooltipStyle(): Record<string, unknown> {
  const { text, border, card } = baseTextOptions();
  return {
    backgroundColor: card,
    borderColor: border,
    textStyle: { color: text },
  };
}

function track(container: HTMLElement, chart: EChartsType): void {
  instances.add(chart);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);
  }
}

export type OnSelect = (name: string) => void;

/** Render a donut (parts-of-whole). */
export async function renderDonut(
  container: HTMLElement,
  segments: readonly DonutSegment[],
  centerValue?: string,
  centerLabel?: string,
  onSelect?: OnSelect,
): Promise<EChartsType | undefined> {
  const core = await loadEcharts();
  if (!core || !container.isConnected) return undefined;
  const { text, muted, card, border } = baseTextOptions();

  const chart = core.init(container, undefined, { renderer: "canvas" });
  const graphic = centerValue
    ? [
        {
          type: "text" as const,
          left: "center",
          top: "40%",
          style: { text: centerValue, textAlign: "center", fill: text, fontSize: 22, fontWeight: 700 },
        },
        {
          type: "text" as const,
          left: "center",
          top: "54%",
          style: { text: centerLabel ?? "", textAlign: "center", fill: muted, fontSize: 12 },
        },
      ]
    : undefined;

  chart.setOption({
    animationDuration: 600,
    animationEasing: "cubicOut",
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)", ...tooltipStyle() },
    legend: {
      type: "scroll",
      bottom: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: muted, fontSize: 11 },
      pageTextStyle: { color: muted },
      pageIconColor: muted,
      pageIconInactiveColor: border,
    },
    series: [
      {
        type: "pie",
        radius: ["54%", "78%"],
        center: ["50%", "42%"],
        avoidLabelOverlap: true,
        minAngle: 2,
        itemStyle: { borderColor: card, borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 10,
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(0, 0, 0, 0.35)" },
        },
        data: segments.map((segment) => ({
          name: segment.label,
          value: segment.value,
          itemStyle: { color: segment.color },
        })),
      },
    ],
    graphic,
  });

  if (onSelect) chart.on("click", (params) => onSelect(String(params.name)));
  track(container, chart);
  return chart;
}

/** Render a horizontal bar chart (ordered distributions). */

export async function renderBar(
  container: HTMLElement,
  segments: readonly DonutSegment[],
  onSelect?: OnSelect,
): Promise<EChartsType | undefined> {
  const core = await loadEcharts();
  if (!core || !container.isConnected) return undefined;
  const { text, muted, grid } = baseTextOptions();

  const chart = core.init(container, undefined, { renderer: "canvas" });
  chart.setOption({
    animationDuration: 600,
    animationEasing: "cubicOut",
    grid: { left: 6, right: 18, top: 8, bottom: 6, containLabel: true },
    tooltip: { trigger: "item", formatter: "{b}: {c}", ...tooltipStyle() },
    xAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: grid } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: segments.map((segment) => segment.label),
      axisLabel: { color: text, fontSize: 11 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: grid } },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 20,
        data: segments.map((segment) => ({
          value: segment.value,
          itemStyle: { color: segment.color, borderRadius: [0, 4, 4, 0] },
        })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.35)" } },
      },
    ],
  });

  if (onSelect) chart.on("click", (params) => onSelect(String(params.name)));
  track(container, chart);
  return chart;
}

/* ------------------------------------------------------------------ */
/* Score gauge                                                         */
/* ------------------------------------------------------------------ */

/** Render a single score as an arc gauge with the value in the middle. */
export async function renderGauge(
  container: HTMLElement,
  value: number,
  color: string,
): Promise<EChartsType | undefined> {
  const core = await loadEcharts();
  if (!core || !container.isConnected) return undefined;
  const { text, grid } = baseTextOptions();

  const chart = core.init(container, undefined, { renderer: "canvas" });
  chart.setOption({
    animationDuration: 800,
    animationEasing: "cubicOut",
    series: [
      {
        type: "gauge",
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        radius: "96%",
        center: ["50%", "56%"],
        progress: { show: true, width: 12, roundCap: true, itemStyle: { color } },
        axisLine: { roundCap: true, lineStyle: { width: 12, color: [[1, grid]] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, 0],
          fontSize: 40,
          fontWeight: 700,
          color: text,
          formatter: "{value}",
        },
        data: [{ value }],
      },
    ],
  });
  track(container, chart);
  return chart;
}
