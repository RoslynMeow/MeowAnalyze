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

const SOURCE = `using System;
using System.Collections.Generic;

// TODO: optimize
public class Calculator
{
    private int value;

    public Calculator(int value)
    {
        this.value = value;
    }

    public int Compute(List<int> items)
    {
        int total = 0;
        foreach (int item in items)
        {
            if (item > 0 && item % 2 == 0)
            {
                total += item;
            }
        }
        return total;
    }
}
`;

describe("C# analyzer", () => {
  it("parses a class and fills the file report", () => {
    const file = analyze("Calc.cs", SOURCE).files[0];
    expect(file?.language).toBe("csharp");
    expect(file?.imports.map((i) => i.module).sort()).toEqual([
      "System",
      "System.Collections.Generic",
    ]);
    expect(file?.markers.todo).toBe(1);
  });

  it("extracts functions, owners and complexity", () => {
    const file = analyze("Calc.cs", SOURCE).files[0];

    const ctor = file?.functions.find((fn) => fn.name === "Calculator");
    expect(ctor?.kind).toBe("constructor");
    expect(ctor?.owner).toBe("Calculator");
    expect(ctor?.params).toBe(1);

    const compute = file?.functions.find((fn) => fn.name === "Compute");
    expect(compute?.kind).toBe("method");
    expect(compute?.owner).toBe("Calculator");
    // 1 + foreach + if + `&&`
    expect(compute?.cyclomatic).toBe(4);
  });

  it("reads classes and their members", () => {
    const file = analyze("Calc.cs", SOURCE).files[0];
    const declaration = file?.declarations.find((d) => d.name === "Calculator");
    expect(declaration?.kind).toBe("class");
    const names = declaration?.members.map((m) => m.name) ?? [];
    expect(names).toContain("value");
    expect(names).toContain("Compute");
  });
});
