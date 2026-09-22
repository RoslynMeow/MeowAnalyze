import { beforeAll, describe, expect, it } from "vitest";
import {
  analyzeSources,
  defaultRegistryWithLanguages,
  type AnalysisReport,
  type LanguageRegistry,
} from "../src/index.js";

let registry: LanguageRegistry;

beforeAll(async () => {
  registry = await defaultRegistryWithLanguages();
});

function analyze(path: string, content: string): AnalysisReport {
  return analyzeSources({ root: "mem", sources: [{ path, content }], registry });
}

const SOURCE = `import java.util.List;

// TODO: optimize
public class Calculator {
    private int value;

    public Calculator(int value) {
        this.value = value;
    }

    public int compute(List<Integer> items) {
        int total = 0;
        for (int item : items) {
            if (item > 0 && item % 2 == 0) {
                total += item;
            }
        }
        try {
            return total;
        } catch (Exception e) {
            return 0;
        }
    }
}
`;

describe("Java analyzer", () => {
  it("parses a class and fills the file report", () => {
    const file = analyze("Calc.java", SOURCE).files[0];
    expect(file?.language).toBe("java");
    expect(file?.imports.map((i) => i.module)).toEqual(["java.util.List"]);
    expect(file?.markers.todo).toBe(1);
    expect(file?.loc.code).toBeGreaterThan(0);
  });

  it("extracts functions, owners and complexity", () => {
    const file = analyze("Calc.java", SOURCE).files[0];

    const ctor = file?.functions.find((fn) => fn.name === "Calculator");
    expect(ctor?.kind).toBe("constructor");
    expect(ctor?.owner).toBe("Calculator");
    expect(ctor?.params).toBe(1);

    const compute = file?.functions.find((fn) => fn.name === "compute");
    expect(compute?.kind).toBe("method");
    expect(compute?.owner).toBe("Calculator");
    // 1 + enhanced-for + if + `&&` + catch
    expect(compute?.cyclomatic).toBe(5);
  });

  it("reads classes and their members", () => {
    const file = analyze("Calc.java", SOURCE).files[0];
    const declaration = file?.declarations.find((d) => d.name === "Calculator");
    expect(declaration?.kind).toBe("class");
    const names = declaration?.members.map((m) => m.name) ?? [];
    expect(names).toContain("value");
    expect(names).toContain("Calculator");
    expect(names).toContain("compute");
  });
});
