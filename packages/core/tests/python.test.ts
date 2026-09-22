import { beforeAll, describe, expect, it } from "vitest";
import {
  analyzeSources,
  registryForPaths,
  type AnalysisReport,
  type LanguageRegistry,
} from "../src/index.js";

let registry: LanguageRegistry;

beforeAll(async () => {
  registry = await registryForPaths(["a.py"]);
});

function analyze(path: string, content: string): AnalysisReport {
  return analyzeSources({ root: "mem", sources: [{ path, content }], registry });
}

const SOURCE = `import os
from typing import List

# TODO: optimize
def compute(n: int) -> int:
    total = 0
    for i in range(n):
        if i % 2 == 0 and i > 2:
            total += i
    return total

class Counter:
    def __init__(self, value: int):
        self.value = value

    def bump(self, by: int) -> int:
        if by > 0:
            self.value += by
        return self.value
`;

describe("Python analyzer", () => {
  it("parses a module and fills the file report", () => {
    const file = analyze("mod.py", SOURCE).files[0];
    expect(file?.language).toBe("python");
    expect(file?.imports.map((i) => i.module).sort()).toEqual(["os", "typing"]);
    expect(file?.markers.todo).toBe(1);
    expect(file?.loc.code).toBeGreaterThan(0);
    expect(file?.loc.physical).toBe(20);
  });

  it("extracts functions, owners and complexity", () => {
    const file = analyze("mod.py", SOURCE).files[0];

    const compute = file?.functions.find((fn) => fn.name === "compute");
    expect(compute?.kind).toBe("function");
    expect(compute?.params).toBe(1);
    // 1 + for + if + `and`
    expect(compute?.cyclomatic).toBe(4);
    expect(compute?.maxNesting).toBe(2);
    expect(compute?.calls).toContain("range");

    const init = file?.functions.find((fn) => fn.name === "__init__");
    expect(init?.kind).toBe("constructor");
    expect(init?.owner).toBe("Counter");
    expect(init?.params).toBe(1); // `self` is not counted

    const bump = file?.functions.find((fn) => fn.name === "bump");
    expect(bump?.kind).toBe("method");
    expect(bump?.owner).toBe("Counter");
    expect(bump?.cyclomatic).toBe(2);
  });

  it("reads classes and their members", () => {
    const file = analyze("mod.py", SOURCE).files[0];
    const counter = file?.declarations.find((d) => d.name === "Counter");
    expect(counter?.kind).toBe("class");
    const names = counter?.members.map((m) => m.name) ?? [];
    expect(names).toContain("value");
    expect(names).toContain("__init__");
    expect(names).toContain("bump");
  });
});
