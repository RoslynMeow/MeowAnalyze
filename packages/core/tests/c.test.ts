import { beforeAll, describe, expect, it } from "vitest";
import {
  analyzeSources,
  registryForPaths,
  type AnalysisReport,
  type LanguageRegistry,
} from "../src/index.js";

let registry: LanguageRegistry;

beforeAll(async () => {
  registry = await registryForPaths(["a.c", "b.cpp"]);
});

function analyze(path: string, content: string): AnalysisReport {
  return analyzeSources({ root: "mem", sources: [{ path, content }], registry });
}

const C_SOURCE = `#include <stdio.h>

// TODO: handle negatives
int add(int a, int b) {
  if (a > 0 && b > 0) {
    return a + b;
  }
  for (int i = 0; i < 3; i++) {
    a += i;
  }
  return 0;
}

int main(void) {
  int x = add(1, 2);
  return x;
}
`;

describe("C analyzer", () => {
  it("parses a C file and fills the file report", () => {
    const report = analyze("math.c", C_SOURCE);
    expect(report.summary.files).toBe(1);
    const file = report.files[0];
    expect(file?.language).toBe("c");
    expect(file?.imports.map((i) => i.module)).toEqual(["stdio.h"]);
    expect(file?.markers.todo).toBe(1);
    expect(file?.loc.code).toBeGreaterThan(0);
    expect(file?.loc.physical).toBe(18);
  });

  it("extracts functions, params and cyclomatic complexity", () => {
    const file = analyze("math.c", C_SOURCE).files[0];
    const add = file?.functions.find((fn) => fn.name === "add");
    expect(add?.params).toBe(2);
    // 1 + if + && + for
    expect(add?.cyclomatic).toBe(4);
    expect(add?.kind).toBe("function");

    const main = file?.functions.find((fn) => fn.name === "main");
    expect(main?.params).toBe(0); // (void)
    expect(main?.calls).toContain("add");
  });

  it("handles C++ classes and member functions", () => {
    const source = `class Counter {
public:
  int value;

  int bump(int by) {
    if (by > 0) {
      value += by;
    }
    return value;
  }
};

int Counter::reset() {
  return 0;
}
`;
    const file = analyze("counter.cpp", source).files[0];
    expect(file?.language).toBe("cpp");
    const bump = file?.functions.find((fn) => fn.name === "bump");
    expect(bump?.kind).toBe("method");
    expect(bump?.owner).toBe("Counter");
    expect(bump?.cyclomatic).toBe(2);

    const reset = file?.functions.find((fn) => fn.name === "reset");
    expect(reset?.owner).toBe("Counter");

    const declaration = file?.declarations.find((d) => d.name === "Counter");
    expect(declaration).toBeDefined();
    expect(declaration?.members.some((m) => m.name === "value")).toBe(true);
    expect(declaration?.members.some((m) => m.name === "bump")).toBe(true);
  });
});
