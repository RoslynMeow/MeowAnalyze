// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getLang, setLang, t } from "../src/i18n.js";

describe("i18n", () => {
  beforeEach(() => {
    localStorage.clear();
    setLang("zh");
  });

  it("defaults to Chinese", () => {
    expect(getLang()).toBe("zh");
    expect(t().landing.openFolder).toBe("打开工程文件夹");
  });

  it("switches to English", () => {
    setLang("en");
    expect(getLang()).toBe("en");
    expect(t().landing.openFolder).toBe("Open project folder");
    expect(t().dashboard.kpi.files).toBe("Files");
  });

  it("interpolates parameters", () => {
    setLang("en");
    expect(t().detail.functionsTitle(3)).toBe(
      "Functions (3) — click a name to locate it",
    );
    setLang("zh");
    expect(t().detail.functionsTitle(3)).toBe("函数(3)—— 点击函数名定位");
  });
});
