import { describe, expect, it } from "vitest";
import { analyzeSources } from "../src/index.js";
import { TypeScriptAnalyzer } from "../src/lang/typescript.js";

const CIRCLE = `import { Base } from "./base";
interface Shape { area(): number; }
export class Circle extends Base implements Shape {
  private radius: number;
  constructor(r: number) { this.radius = r; }
  area(): number {
    if (this.radius > 0) {
      return compute(this.radius);
    }
    return 0;
  }
}
function compute(n: number) { return n * n; }
`;

describe("declarations and imports", () => {
  const report = new TypeScriptAnalyzer().analyze({
    path: "circle.ts",
    source: CIRCLE,
    language: "typescript",
  });

  it("collects classes and interfaces", () => {
    const names = report.declarations.map((d) => `${d.kind}:${d.name}`).sort();
    expect(names).toEqual(["class:Circle", "interface:Shape"]);
  });

  it("records heritage", () => {
    const circle = report.declarations.find((d) => d.name === "Circle");
    expect(circle?.extends).toEqual(["Base"]);
    expect(circle?.implements).toEqual(["Shape"]);
  });

  it("records members with visibility and kinds", () => {
    const circle = report.declarations.find((d) => d.name === "Circle");
    expect(circle?.members.map((m) => `${m.kind}:${m.name}`)).toEqual([
      "property:radius",
      "constructor:constructor",
      "method:area",
    ]);
    expect(circle?.members.find((m) => m.name === "radius")?.visibility).toBe("private");
  });

  it("collects imports", () => {
    expect(report.imports).toEqual([
      { module: "./base", names: ["Base"], typeOnly: false },
    ]);
  });

  it("extracts a control-flow tree and call sites", () => {
    const area = report.functions.find((f) => f.name === "area");
    expect(area?.flow.some((node) => node.kind === "decision")).toBe(true);
    expect(area?.calls).toContain("compute");
  });
});

describe("project structure", () => {
  const report = analyzeSources({
    root: "mem",
    sources: [
      { path: "circle.ts", content: CIRCLE },
      { path: "base.ts", content: "export class Base {}\n" },
    ],
  });

  it("resolves relative module dependencies", () => {
    expect(report.structure.dependencies).toContainEqual({
      from: "circle.ts",
      to: "base.ts",
    });
  });

  it("builds a static call graph when the name is unambiguous", () => {
    const computeId = report.files
      .flatMap((f) => f.functions)
      .find((f) => f.name === "compute")?.id;
    expect(report.structure.calls).toContainEqual(
      expect.objectContaining({ to: computeId }),
    );
  });
});
