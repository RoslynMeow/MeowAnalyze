import { beforeAll, describe, expect, it } from "vitest";
import {
  analyzeSources,
  registryForPaths,
  type AnalysisReport,
  type LanguageRegistry,
} from "../src/index.js";

let registry: LanguageRegistry;

beforeAll(async () => {
  registry = await registryForPaths(["a.go", "a.rs", "data.json"]);
});

function analyze(path: string, content: string): AnalysisReport {
  return analyzeSources({ root: "mem", sources: [{ path, content }], registry });
}

describe("generic tree-sitter languages", () => {
  it("analyzes Go (tuned profile)", () => {
    const source = `package main

import "fmt"

// TODO: tidy
func add(a int, b int) int {
	if a > 0 && b > 0 {
		return a + b
	}
	for i := 0; i < 3; i++ {
		a += i
	}
	return 0
}

type Point struct {
	X int
	Y int
}

func (p Point) Sum() int {
	return p.X + p.Y
}
`;
    const file = analyze("main.go", source).files[0];
    expect(file?.language).toBe("go");
    expect(file?.imports.map((i) => i.module)).toEqual(["fmt"]);
    expect(file?.markers.todo).toBe(1);

    const add = file?.functions.find((fn) => fn.name === "add");
    expect(add?.params).toBe(2);
    expect(add?.cyclomatic).toBe(4); // 1 + if + && + for

    const sum = file?.functions.find((fn) => fn.name === "Sum");
    expect(sum?.kind).toBe("method");
    expect(sum?.owner).toBe("Point");

    const point = file?.declarations.find((d) => d.name === "Point");
    expect(point?.members.map((m) => m.name)).toEqual(["X", "Y"]);
  });

  it("analyzes Rust", () => {
    const source = `// TODO: tidy
fn add(a: i32, b: i32) -> i32 {
    if a > 0 && b > 0 {
        return a + b;
    }
    0
}
`;
    const file = analyze("lib.rs", source).files[0];
    expect(file?.language).toBe("rust");
    expect(file?.markers.todo).toBe(1);
    const add = file?.functions.find((fn) => fn.name === "add");
    expect(add?.params).toBe(2);
    expect(add?.cyclomatic).toBe(3); // 1 + if + &&
  });

  it("records lines of code for markup languages", () => {
    const file = analyze("data.json", '{\n  "a": 1,\n  "b": 2\n}\n').files[0];
    expect(file?.language).toBe("json");
    expect(file?.loc.code).toBeGreaterThan(0);
    expect(file?.functions).toHaveLength(0);
  });
});
