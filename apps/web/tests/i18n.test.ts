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
    expect(t().landing.openFolder).toBe("打开文件夹");
  });

  it("switches to English", () => {
    setLang("en");
    expect(getLang()).toBe("en");
    expect(t().landing.openFolder).toBe("Open folder");
    expect(t().dashboard.kpi.files).toBe("Files");
  });

  it("interpolates parameters", () => {
    setLang("en");
    expect(t().dashboard.pills.files(3)).toBe("3 files");
    setLang("zh");
    expect(t().dashboard.pills.files(3)).toBe("3 个文件");
  });
});
