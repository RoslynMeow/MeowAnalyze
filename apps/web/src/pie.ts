import { PieChart } from "echarts/charts";
import { LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { DonutSegment } from "./charts.js";

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer]);

const instances = new Set<echarts.ECharts>();

/** Dispose every chart created so far (call before re-rendering a view). */
export function disposeCharts(): void {
  for (const chart of instances) chart.dispose();
  instances.clear();
}

export interface PieOptions {
  segments: DonutSegment[];
  centerValue?: string;
  centerLabel?: string;
}

function cssVar(name: string): string {
  if (typeof getComputedStyle !== "function") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** Canvas is unavailable in some environments (e.g. jsdom); skip gracefully. */
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

/** Render a donut chart into `container` with ECharts. */
export function pieChart(container: HTMLElement, options: PieOptions): void {
  if (!canvasSupported()) return;

  const chart = echarts.init(container, undefined, { renderer: "canvas" });
  instances.add(chart);

  const text = cssVar("--text") || "#e6edf3";
  const muted = cssVar("--muted") || "#8b949e";

  const graphic = options.centerValue
    ? [
        {
          type: "text" as const,
          left: "center",
          top: "42%",
          style: {
            text: options.centerValue,
            textAlign: "center",
            fill: text,
            fontSize: 22,
            fontWeight: 700,
          },
        },
        {
          type: "text" as const,
          left: "center",
          top: "56%",
          style: {
            text: options.centerLabel ?? "",
            textAlign: "center",
            fill: muted,
            fontSize: 12,
          },
        },
      ]
    : undefined;

  chart.setOption({
    animationDuration: 600,
    animationEasing: "cubicOut",
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
      backgroundColor: cssVar("--bg-soft") || "#161b22",
      borderColor: cssVar("--border") || "#30363d",
      textStyle: { color: text },
    },
    legend: {
      type: "scroll",
      bottom: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: muted, fontSize: 11 },
      pageTextStyle: { color: muted },
      pageIconColor: muted,
      pageIconInactiveColor: cssVar("--border") || "#30363d",
    },
    series: [
      {
        type: "pie",
        radius: ["56%", "80%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        minAngle: 2,
        itemStyle: {
          borderColor: cssVar("--bg-card") || "#161b22",
          borderWidth: 2,
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 10,
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(0, 0, 0, 0.35)" },
        },
        data: options.segments.map((segment) => ({
          name: segment.label,
          value: segment.value,
          itemStyle: { color: segment.color },
        })),
      },
    ],
    graphic,
  });

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);
  }
}
