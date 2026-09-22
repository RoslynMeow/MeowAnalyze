// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getTheme, setTheme, toggleTheme } from "../src/theme.js";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    setTheme("dark");
  });

  it("defaults to dark", () => {
    expect(getTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("applies the light theme to the document", () => {
    setTheme("light");
    expect(getTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("toggles between dark and light", () => {
    toggleTheme();
    expect(getTheme()).toBe("light");
    toggleTheme();
    expect(getTheme()).toBe("dark");
  });

  it("persists the choice", () => {
    setTheme("light");
    expect(localStorage.getItem("meowanalyze.theme")).toBe("light");
  });
});
