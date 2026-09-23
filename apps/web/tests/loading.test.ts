// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hideLoading, setLoadingProgress, showLoading } from "../src/loading.js";

describe("loading overlay", () => {
  it("shows a label, updates progress and hides", () => {
    showLoading("Reading files");

    const overlay = document.body.querySelector<HTMLElement>(".loading-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay?.hidden).toBe(false);
    expect(document.body.querySelector(".loading__label")?.textContent).toBe(
      "Reading files",
    );

    setLoadingProgress(3, 6);
    const fill = document.body.querySelector<HTMLElement>(".loading__fill");
    expect(fill?.style.width).toBe("50%");

    setLoadingProgress(0, 0);
    expect(
      document.body.querySelector(".loading__bar--indeterminate"),
    ).not.toBeNull();

    hideLoading();
    expect(overlay?.hidden).toBe(true);
  });
});
