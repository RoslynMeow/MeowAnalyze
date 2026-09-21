// @vitest-environment jsdom
import { analyzeSources } from "@meowanalyze/core";
import { describe, expect, it } from "vitest";
import {
  activityDiagramXml,
  classDiagramXml,
  communicationDiagramXml,
  entityRelationshipXml,
  packageDiagramXml,
} from "../src/drawio.js";

const SOURCE = `import { Base } from "./base";
export class Circle extends Base implements Shape {
  private radius: number;
  area(): number { if (this.radius > 0) return compute(this.radius); return 0; }
}
interface Shape { area(): number; }
function compute(n: number) { return n * n; }
`;

function report() {
  return analyzeSources({
    root: "mem",
    sources: [
      { path: "circle.ts", content: SOURCE },
      { path: "base.ts", content: "export class Base {}\n" },
    ],
  });
}

function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  return doc;
}

describe("draw.io XML generators", () => {
  it("builds a class diagram with UML relations and members", () => {
    const xml = classDiagramXml(report().structure);
    const doc = parse(xml);
    expect(doc.querySelector("mxGraphModel")).not.toBeNull();
    expect(xml).toContain("endArrow=block;endFill=0"); // generalization
    expect(xml).toContain("dashed=1"); // realization
    expect(xml).toContain("radius");
    // XML decodes the HTML value back for the editor
    const values = [...doc.querySelectorAll("mxCell")].map((c) => c.getAttribute("value") ?? "");
    expect(values.some((v) => v.includes("Circle"))).toBe(true);
  });

  it("builds a package diagram with «import» edges", () => {
    const xml = packageDiagramXml(report().structure);
    parse(xml);
    expect(xml).toContain("«import»");
  });

  it("builds an activity diagram with start/end and a decision", () => {
    const fn = report()
      .files.flatMap((file) => file.functions)
      .find((f) => f.name === "area");
    const xml = activityDiagramXml(fn!);
    parse(xml);
    expect(xml).toContain("mm_start");
    expect(xml).toContain("mm_end");
    expect(xml).toContain("rhombus");
  });

  it("builds a communication diagram from calls", () => {
    const r = report();
    const byId = new Map(
      r.files.flatMap((file) => file.functions).map((fn) => [fn.id, fn]),
    );
    const xml = communicationDiagramXml(r.structure, byId);
    parse(xml);
    expect(xml).toContain("compute");
  });

  it("builds an ER diagram with tables and cardinality", () => {
    const r = analyzeSources({
      root: "mem",
      sources: [
        {
          path: "models.ts",
          content:
            "export class User { id: string; friend?: User; posts: Post[]; }\n" +
            "export class Post { author: User; }\n",
        },
      ],
    });
    const xml = entityRelationshipXml(r.structure);
    parse(xml);
    expect(xml).toContain("shape=table");
    expect(xml).toContain("ERzeroToMany");
    expect(xml).toContain("ERzeroToOne");
  });

  it("returns an empty string when there is nothing to draw", () => {
    const empty = analyzeSources({ root: "mem", sources: [{ path: "a.ts", content: "export const a = 1;\n" }] });
    expect(classDiagramXml(empty.structure)).toBe("");
    expect(packageDiagramXml(empty.structure)).toBe("");
  });
});
