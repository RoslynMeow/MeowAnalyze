// @vitest-environment jsdom
import { analyzeSources } from "@meowanalyze/core";
import { describe, expect, it } from "vitest";
import { renderReport } from "../src/render.js";

const SOURCE = `export function simple(a: number) {
  return a + 1;
}

export function branchy(n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0 && i > 2) {
      total += i;
    } else if (i < 0) {
      total -= i;
    }
  }
  return total;
}

export const arrow = (x: number) => (x > 0 ? x : -x);
`;

function sampleReport() {
  return analyzeSources({
    root: "sample",
    sources: [{ path: "src/a.ts", content: SOURCE }],
  });
}

describe("renderReport", () => {
  it("renders charts, tables and the file list", () => {
    const root = document.createElement("div");
    renderReport(root, sampleReport());

    expect(root.querySelectorAll("svg.chart").length).toBeGreaterThan(0);
    expect(root.querySelector("svg.chart--donut")).not.toBeNull();
    expect(root.querySelectorAll("table.data").length).toBeGreaterThan(0);
    expect(root.querySelector("details.file")).not.toBeNull();
    expect(root.textContent).toContain("src/a.ts");
    expect(root.textContent).toContain("branchy");
  });

  it("opens the matching file when a bar is clicked", () => {
    const root = document.createElement("div");
    renderReport(root, sampleReport());

    const bar = root.querySelector<SVGElement>(".chart__bar--clickable[data-key]");
    expect(bar).not.toBeNull();
    bar?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const key = bar?.getAttribute("data-key");
    const details = root.querySelector<HTMLDetailsElement>(
      `details.file[data-path="${key}"]`,
    );
    expect(details?.open).toBe(true);
  });

  it("filters the file list", () => {
    const root = document.createElement("div");
    renderReport(root, sampleReport());

    const filter = root.querySelector<HTMLInputElement>("input.filter");
    expect(filter).not.toBeNull();
    if (!filter) return;
    filter.value = "does-not-exist";
    filter.dispatchEvent(new Event("input"));

    const details = root.querySelector<HTMLDetailsElement>("details.file");
    expect(details?.hidden).toBe(true);
  });
});
