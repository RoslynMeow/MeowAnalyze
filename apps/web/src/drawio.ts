/**
 * Build draw.io (mxGraph) XML for the diagrams. The draw.io embed runs an
 * ELK layout after loading, so cells are emitted at the origin and positioned
 * by the editor. Output can also be saved as a `.drawio` file.
 */

import type {
  DeclarationReport,
  FlowNode,
  FunctionReport,
  MemberReport,
  StructureModel,
} from "@meowanalyze/core";

export type DiagramKind =
  | "class"
  | "package"
  | "activity"
  | "sequence"
  | "state"
  | "er"
  | "communication";

export interface LayoutSpec {
  layout: string;
  config?: Record<string, string>;
}

/**
 * draw.io layout run after load, per diagram kind. Uses explicit ELK spacing
 * (defaults are 30) so nodes are not packed so tightly that edges overlap.
 */
export const LAYOUT: Record<DiagramKind, readonly LayoutSpec[]> = {
  class: [
    {
      layout: "elkLayered",
      config: {
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "70",
        "elk.layered.spacing.nodeNodeBetweenLayers": "110",
        "elk.edgeRouting": "ORTHOGONAL",
      },
    },
    { layout: "mxParallelEdgeLayout", config: { spacing: "40", checkOverlap: "true" } },
  ],
  package: [
    {
      layout: "elkLayered",
      config: {
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "70",
        "elk.layered.spacing.nodeNodeBetweenLayers": "120",
        "elk.edgeRouting": "ORTHOGONAL",
      },
    },
  ],
  activity: [
    {
      layout: "elkLayered",
      config: {
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": "50",
        "elk.layered.spacing.nodeNodeBetweenLayers": "60",
        "elk.edgeRouting": "ORTHOGONAL",
      },
    },
  ],
  // Sequence is positioned by hand (lifelines + messages), no auto layout.
  sequence: [],
  state: [
    {
      layout: "elkLayered",
      config: {
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "70",
        "elk.layered.spacing.nodeNodeBetweenLayers": "110",
        "elk.edgeRouting": "ORTHOGONAL",
      },
    },
  ],
  er: [{ layout: "elkOrganic", config: { "elk.spacing.nodeNode": "90" } }],
  communication: [
    {
      layout: "elkLayered",
      config: {
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "70",
        "elk.layered.spacing.nodeNodeBetweenLayers": "120",
      },
    },
    { layout: "mxParallelEdgeLayout", config: { spacing: "40", checkOverlap: "true" } },
  ],
};

/* ------------------------------------------------------------------ */
/* XML primitives                                                      */
/* ------------------------------------------------------------------ */

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(cells: string[]): string {
  return (
    '<mxGraphModel dx="800" dy="600" grid="0" gridSize="10" guides="1" tooltips="1" ' +
    'connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="850" ' +
    'pageHeight="1100" math="0" shadow="0"><root><mxCell id="0"/>' +
    `<mxCell id="1" parent="0"/>${cells.join("")}</root></mxGraphModel>`
  );
}

function vertex(id: string, value: string, style: string, width: number, height: number): string {
  return vertexAt(id, value, style, 0, 0, width, height);
}

function vertexAt(
  id: string,
  value: string,
  style: string,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  return (
    `<mxCell id="${id}" value="${escapeXml(value)}" style="${style}" vertex="1" parent="1">` +
    `<mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`
  );
}

function edge(id: string, source: string, target: string, style: string, label = ""): string {
  return (
    `<mxCell id="${id}" value="${escapeXml(label)}" style="${style}" edge="1" parent="1" ` +
    `source="${source}" target="${target}"><mxGeometry relative="1" as="geometry"/></mxCell>`
  );
}

/** A child cell inside a class compartment (attribute / method / divider). */
function row(
  id: string,
  parent: string,
  value: string,
  style: string,
  width: number,
  height: number,
  y: number,
): string {
  return (
    `<mxCell id="${id}" value="${escapeXml(value)}" style="${style}" vertex="1" parent="${parent}">` +
    `<mxGeometry x="0" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`
  );
}

/* Styles */
/** draw.io's native UML class shape: a swimlane with stacked compartments. */
function classStyle(startSize: number): string {
  return (
    `swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;` +
    `startSize=${startSize};horizontalStack=0;resizeParent=1;resizeParentMax=0;collapse=1;` +
    `marginBottom=0;html=1;fontFamily=Helvetica;fontSize=12;fillColor=#ffffff;strokeColor=#3b4552;`
  );
}
const STYLE_ROW =
  "text;html=1;align=left;verticalAlign=middle;spacingLeft=6;spacingRight=6;overflow=hidden;" +
  "rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fontSize=12;strokeColor=none;fillColor=none;";
const STYLE_DIVIDER =
  "line;html=1;strokeWidth=1;align=left;verticalAlign=middle;spacingTop=-1;spacingLeft=3;" +
  "spacingRight=3;rotatable=0;labelPosition=right;points=[];portConstraint=eastwest;strokeColor=inherit;";
const STYLE_GENERALIZATION = "endArrow=block;endFill=0;html=1;rounded=0;strokeColor=#3b4552;";
const STYLE_REALIZATION = "endArrow=block;endFill=0;dashed=1;html=1;rounded=0;strokeColor=#3b4552;";
const STYLE_ASSOCIATION = "endArrow=open;endFill=0;html=1;rounded=0;strokeColor=#3b4552;";
const STYLE_DEPENDENCY = "endArrow=open;endFill=0;dashed=1;html=1;rounded=0;strokeColor=#8b949e;";
/** UML package symbol (folder with a tab). */
const STYLE_PACKAGE =
  "shape=folder;whiteSpace=wrap;html=1;fontFamily=Helvetica;fontSize=12;" +
  "fillColor=#eef2f7;strokeColor=#3b4552;";
const STYLE_NODE =
  "rounded=1;whiteSpace=wrap;html=1;fontFamily=Helvetica;fontSize=12;" +
  "fillColor=#eef2f7;strokeColor=#3b4552;";
const STYLE_START =
  "ellipse;html=1;fillColor=#3b4552;strokeColor=#3b4552;fontColor=#ffffff;";
const STYLE_END =
  "ellipse;html=1;fillColor=#ffffff;strokeColor=#3b4552;strokeWidth=3;";
const STYLE_ACTION =
  "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#3b4552;fontSize=12;";
const STYLE_DECISION =
  "rhombus;whiteSpace=wrap;html=1;fillColor=#fff7e6;strokeColor=#b8860b;fontSize=12;";
const STYLE_LOOP =
  "hexagon;whiteSpace=wrap;html=1;fillColor=#eef7ff;strokeColor=#3b6ea5;fontSize=12;";
const STYLE_EDGE = "html=1;rounded=0;strokeColor=#3b4552;";

/* ------------------------------------------------------------------ */
/* Class diagram                                                       */
/* ------------------------------------------------------------------ */

function memberText(member: MemberReport): string {
  const mark = member.visibility === "private" ? "-" : member.visibility === "protected" ? "#" : "+";
  const stat = member.static ? "$" : "";
  const name = member.name;
  const type = member.type ? ` ${cleanType(member.type)}` : "";
  if (member.kind === "enum-member") return name;
  if (member.kind === "property") return `${mark}${stat}${name}${type}`;
  return `${mark}${stat}${name}()${type}`;
}

const FONT = "12px Helvetica, Arial, sans-serif";

/** Width of the widest line, measured with the canvas API when available. */
function textWidth(lines: readonly string[]): number {
  const fallback = lines.reduce((max, line) => Math.max(max, line.length * 6.4), 0);
  if (typeof document === "undefined") return fallback;
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return fallback;
    ctx.font = FONT;
    let max = 0;
    for (const line of lines) max = Math.max(max, ctx.measureText(line).width);
    return max > 0 ? max : fallback;
  } catch {
    return fallback;
  }
}

function escapeAttrHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cleanType(type: string): string {
  return type.replace(/\s+/g, " ").trim();
}

function stereotypeOf(declaration: DeclarationReport): string {
  if (declaration.kind === "interface") return "«interface»";
  if (declaration.kind === "enum") return "«enumeration»";
  return declaration.abstract ? "«abstract»" : "";
}

/** Emit a draw.io UML class (a swimlane with attribute/method compartments). */
function classCell(declaration: DeclarationReport, id: string): string[] {
  const stereotype = stereotypeOf(declaration);
  const startSize = stereotype ? 42 : 28;

  const attributes = declaration.members.filter(
    (member) => member.kind === "property" || member.kind === "enum-member",
  );
  const methods = declaration.members.filter(
    (member) => member.kind !== "property" && member.kind !== "enum-member",
  );

  interface CompartmentRow {
    /** Plain text, for width measurement. */
    raw: string;
    /** HTML-escaped text, used as the cell value. */
    value: string;
    height: number;
    divider?: boolean;
  }
  const makeRow = (member: MemberReport, height = 20): CompartmentRow => {
    const raw = memberText(member);
    return { raw, value: escapeAttrHtml(raw), height };
  };
  const rows: CompartmentRow[] = [];
  for (const member of attributes) rows.push(makeRow(member));
  if (attributes.length > 0 && methods.length > 0) {
    rows.push({ raw: "", value: "", height: 8, divider: true });
  }
  for (const member of methods) rows.push(makeRow(member));

  const width = Math.min(
    520,
    Math.max(90, Math.ceil(textWidth([declaration.name, ...rows.map((r) => r.raw)])) + 24),
  );
  const height = startSize + rows.reduce((sum, row) => sum + row.height, 0) + 4;

  const title = `<b>${escapeAttrHtml(declaration.name)}</b>${
    stereotype ? `<br><i>${stereotype}</i>` : ""
  }`;
  const cell = vertex(id, title, classStyle(startSize), width, height);

  const children: string[] = [];
  let y = startSize;
  rows.forEach((entry, index) => {
    children.push(
      row(
        `${id}_${index}`,
        id,
        entry.value,
        entry.divider ? STYLE_DIVIDER : STYLE_ROW,
        width,
        entry.height,
        y,
      ),
    );
    y += entry.height;
  });

  return [cell, ...children];
}

export function classDiagramXml(structure: StructureModel): string {
  const declarations = structure.declarations;
  if (declarations.length === 0) return "";

  const ids = new Map<string, string>();
  declarations.forEach((declaration, index) => {
    if (!ids.has(declaration.name)) ids.set(declaration.name, `c${index}`);
  });

  const cells: string[] = [];
  let counter = 0;
  const external = new Map<string, string>();
  const idFor = (name: string): string => {
    const existing = ids.get(name);
    if (existing) return existing;
    const made = external.get(name);
    if (made) return made;
    const next = `x${external.size}`;
    external.set(name, next);
    const width = Math.max(90, Math.ceil(textWidth([name])) + 24);
    cells.push(vertex(next, escapeAttrHtml(name), classStyle(28), width, 48));
    return next;
  };

  for (const declaration of declarations) {
    const id = ids.get(declaration.name);
    if (!id) continue;
    cells.push(...classCell(declaration, id));
  }

  const seen = new Set<string>();
  const relation = (from: string, to: string, style: string): void => {
    const source = ids.get(from);
    const target = idFor(to);
    const key = `${source}|${target}|${style}`;
    if (!source || seen.has(key)) return;
    seen.add(key);
    cells.push(edge(`e${counter++}`, source, target, style));
  };

  for (const declaration of declarations) {
    for (const base of declaration.extends) relation(declaration.name, base, STYLE_GENERALIZATION);
    for (const iface of declaration.implements) relation(declaration.name, iface, STYLE_REALIZATION);
    for (const member of declaration.members) {
      if (member.kind !== "property" || !member.type) continue;
      for (const type of referencedTypes(member.type, ids)) {
        relation(declaration.name, type, STYLE_ASSOCIATION);
      }
    }
  }

  return wrap(cells);
}

function referencedTypes(type: string, ids: ReadonlyMap<string, string>): string[] {
  const names = type.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [];
  return [...new Set(names.filter((name) => ids.has(name)))];
}

/* ------------------------------------------------------------------ */
/* Package / module dependency diagram                                 */
/* ------------------------------------------------------------------ */

export function packageDiagramXml(structure: StructureModel): string {
  const dependencies = structure.dependencies;
  if (dependencies.length === 0) return "";

  const paths = [...new Set(dependencies.flatMap((edge) => [edge.from, edge.to]))];
  const ids = new Map(paths.map((path, index) => [path, `m${index}`]));

  const cells: string[] = [];
  for (const path of paths) {
    const id = ids.get(path) as string;
    const width = Math.min(380, Math.max(150, Math.ceil(textWidth([path])) + 36));
    cells.push(vertex(id, path, STYLE_PACKAGE, width, 70));
  }
  let counter = 0;
  for (const dependency of dependencies) {
    cells.push(
      edge(`e${counter++}`, ids.get(dependency.from) as string, ids.get(dependency.to) as string, STYLE_DEPENDENCY, "«import»"),
    );
  }
  return wrap(cells);
}

/* ------------------------------------------------------------------ */
/* Activity diagram                                                    */
/* ------------------------------------------------------------------ */

export function activityDiagramXml(fn: FunctionReport): string {
  if (fn.flow.length === 0) return "";
  return wrap(activityCells(fn.flow));
}

function activityCells(flow: readonly FlowNode[]): string[] {
  const cells: string[] = [];
  let node = 0;
  let edgeId = 0;
  const nextId = (): string => `n${node++}`;

  cells.push(vertex("mm_start", "start", STYLE_START, 40, 40));
  cells.push(vertex("mm_end", "end", STYLE_END, 40, 40));

  const connect = (from: string, to: string, label?: string): void => {
    cells.push(edge(`e${edgeId++}`, from, to, STYLE_EDGE, label ?? ""));
  };

  const terminators: string[] = [];

  interface Built {
    exit: string;
    /** Whether control can continue past this node (false after return/throw). */
    fallsThrough: boolean;
  }

  const build = (nodes: readonly FlowNode[], from: string, label?: string): Built => {
    let current = from;
    let currentLabel = label;
    let falls = true;
    for (const item of nodes) {
      if (item.kind === "action" || item.kind === "terminator") {
        if (!item.text.trim()) continue;
        const id = nextId();
        cells.push(vertex(id, item.text, STYLE_ACTION, 180, 40));
        connect(current, id, currentLabel);
        current = id;
        currentLabel = undefined;
        falls = item.kind !== "terminator";
        if (item.kind === "terminator") terminators.push(id);
      } else if (item.kind === "loop") {
        const id = nextId();
        cells.push(vertex(id, item.label, STYLE_LOOP, 140, 50));
        connect(current, id, currentLabel);
        const body = build(item.body, id);
        connect(body.exit, id);
        current = id;
        currentLabel = undefined;
        falls = true;
      } else {
        const condition = item.branches[0]?.label ?? "";
        const id = nextId();
        cells.push(vertex(id, condition, STYLE_DECISION, 120, 70));
        connect(current, id, currentLabel);

        const candidates: string[] = [];
        for (const branch of item.branches) {
          const built = build(branch.body, id, branch.label);
          if (built.fallsThrough) candidates.push(built.exit);
        }
        // An if without else (or a switch without default) has an implicit
        // path that skips straight past the decision.
        if (item.branches.length <= 1) candidates.push(id);

        const unique = [...new Set(candidates)];
        if (unique.length === 0) {
          current = id;
          falls = false;
        } else if (unique.length === 1) {
          current = unique[0] as string;
          falls = true;
        } else {
          const merge = nextId();
          cells.push(vertex(merge, "", STYLE_ACTION, 20, 20));
          for (const candidate of unique) connect(candidate, merge);
          current = merge;
          falls = true;
        }
        currentLabel = undefined;
      }
    }
    return { exit: current, fallsThrough: falls };
  };

  const built = build(flow, "mm_start");
  // Every return / throw flows into the final node, as does the fall-through exit.
  for (const terminator of terminators) connect(terminator, "mm_end");
  if (built.fallsThrough) connect(built.exit, "mm_end");
  return cells;
}

/* ------------------------------------------------------------------ */
/* ER / entity-relationship diagram (from typed fields)                */
/* ------------------------------------------------------------------ */

function erTableStyle(startSize: number): string {
  return (
    `shape=table;startSize=${startSize};container=1;collapsible=0;childLayout=tableLayout;` +
    "fixedRows=1;rowLines=1;fontStyle=1;align=center;resizeLast=1;html=1;fontFamily=Helvetica;" +
    "fontSize=12;fillColor=#ffffff;strokeColor=#3b4552;"
  );
}
const ER_ROW =
  "shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;fillColor=none;" +
  "collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;top=0;left=0;" +
  "right=0;bottom=0;html=1;";
const ER_CELL =
  "shape=partialRectangle;overflow=hidden;connectable=0;fillColor=none;top=0;left=0;bottom=0;" +
  "right=0;align=left;spacingLeft=6;html=1;fontSize=12;";
const ER_START = 26;
const ER_ROW_HEIGHT = 26;

/** Cardinality marker based on optionality and the field's type text. */
function cardinality(member: MemberReport): string {
  const type = member.type ?? "";
  if (/\[\s*\]$/.test(type) || /\b(Array|ReadonlyArray|List|Set|ReadonlySet|Map|Record|Collection)</.test(type)) {
    return "ERzeroToMany";
  }
  if (member.optional || /\bundefined\b|\bnull\b|Optional</.test(type)) return "ERzeroToOne";
  return "ERone";
}

function entitiesOf(structure: StructureModel): DeclarationReport[] {
  return structure.declarations.filter((declaration) =>
    declaration.members.some((member) => member.kind === "property"),
  );
}

function entityCell(declaration: DeclarationReport, id: string): string[] {
  const fields = declaration.members.filter((member) => member.kind === "property");
  const labels = fields.map((member) => memberText(member));
  const width = Math.min(
    360,
    Math.max(150, Math.ceil(textWidth([declaration.name, ...labels])) + 30),
  );
  const height = ER_START + fields.length * ER_ROW_HEIGHT + 2;

  const cells: string[] = [
    vertex(id, escapeAttrHtml(declaration.name), erTableStyle(ER_START), width, height),
  ];
  fields.forEach((member, index) => {
    const rowId = `${id}r${index}`;
    const y = ER_START + index * ER_ROW_HEIGHT;
    cells.push(row(rowId, id, "", ER_ROW, width, ER_ROW_HEIGHT, y));
    cells.push(
      row(`${rowId}c`, rowId, escapeAttrHtml(memberText(member)), ER_CELL, width, ER_ROW_HEIGHT, 0),
    );
  });
  return cells;
}

export function entityRelationshipXml(structure: StructureModel): string {
  const entities = entitiesOf(structure);
  if (entities.length === 0) return "";

  const ids = new Map<string, string>();
  entities.forEach((declaration, index) => {
    if (!ids.has(declaration.name)) ids.set(declaration.name, `t${index}`);
  });

  const cells: string[] = [];
  let counter = 0;
  for (const declaration of entities) {
    const id = ids.get(declaration.name);
    if (id) cells.push(...entityCell(declaration, id));
  }

  const seen = new Set<string>();
  for (const declaration of entities) {
    const source = ids.get(declaration.name);
    if (!source) continue;
    for (const member of declaration.members) {
      if (member.kind !== "property" || !member.type) continue;
      for (const target of referencedTypes(member.type, ids)) {
        const targetId = ids.get(target);
        if (!targetId) continue;
        const key = `${source}->${targetId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const style =
          "edgeStyle=entityRelationEdgeStyle;html=1;startArrow=ERone;startFill=0;" +
          `endArrow=${cardinality(member)};endFill=0;fontSize=11;`;
        cells.push(edge(`e${counter++}`, source, targetId, style));
      }
    }
  }

  return wrap(cells);
}

/* ------------------------------------------------------------------ */
/* Communication diagram (static call graph)                           */
/* ------------------------------------------------------------------ */

function shortId(id: string): string {
  const parts = id.split(":");
  const path = parts[0] ?? "";
  const line = parts[1];
  const name = parts.slice(2).join(":") || id;
  return `${name}\n${path}${line ? `:${line}` : ""}`;
}

export function communicationDiagramXml(
  structure: StructureModel,
  functions: ReadonlyMap<string, FunctionReport>,
): string {
  const calls = structure.calls;
  if (calls.length === 0) return "";

  const ids = new Map<string, string>();
  const idFor = (fnId: string): string => {
    const existing = ids.get(fnId);
    if (existing) return existing;
    const next = `f${ids.size}`;
    ids.set(fnId, next);
    return next;
  };
  for (const call of calls) {
    idFor(call.from);
    idFor(call.to);
  }

  const cells: string[] = [];
  for (const [fnId, id] of ids) {
    const label = functions.get(fnId) ? shortId(fnId) : fnId;
    const width = Math.min(360, Math.max(140, Math.ceil(textWidth(label.split("\n"))) + 32));
    cells.push(vertex(id, label, STYLE_NODE, width, 54));
  }
  let counter = 0;
  for (const call of calls) {
    cells.push(
      edge(`e${counter++}`, ids.get(call.from) as string, ids.get(call.to) as string, STYLE_EDGE),
    );
  }
  return wrap(cells);
}

/* ------------------------------------------------------------------ */
/* Sequence diagram (static approximation of one function's calls)     */
/* ------------------------------------------------------------------ */

const STYLE_LIFELINE =
  "shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=0;" +
  "collapsible=0;recursiveResize=0;outlineConnect=0;fontFamily=Helvetica;fontSize=12;" +
  "fillColor=#ffffff;strokeColor=#3b4552;";
const STYLE_MESSAGE = "html=1;endArrow=block;endFill=1;rounded=0;strokeColor=#3b4552;fontSize=11;";

/**
 * A sequence-like view of the calls a function makes, in source order. Not a
 * real runtime sequence: messages all originate from the selected function.
 */
export function sequenceDiagramXml(fn: FunctionReport): string {
  const calls = [...new Set(fn.calls)].slice(0, 8);
  if (calls.length === 0) return "";

  const participants = [fn.name, ...calls];
  const top = 24;
  const colWidth = 170;
  const gap = 60;
  const headerHeight = 40;
  const step = 36;
  const height = headerHeight + calls.length * step + 70;

  const cells: string[] = [];
  participants.forEach((label, index) => {
    const x = 30 + index * (colWidth + gap);
    cells.push(
      vertexAt(`p${index}`, escapeAttrHtml(label), STYLE_LIFELINE, x, top, colWidth, height),
    );
  });

  calls.forEach((call, index) => {
    const y = top + headerHeight + 30 + index * step;
    const fraction = ((y - top) / height).toFixed(3);
    const style =
      `${STYLE_MESSAGE}exitX=1;exitY=${fraction};exitDx=0;exitDy=0;` +
      `entryX=0;entryY=${fraction};entryDx=0;entryDy=0;`;
    cells.push(edge(`e${index}`, "p0", `p${index + 1}`, style, call));
  });

  return wrap(cells);
}

/* ------------------------------------------------------------------ */
/* State machine diagram (heuristic, aggregated over a class)          */
/* ------------------------------------------------------------------ */

interface StateTransition {
  from: string;
  to: string;
  event: string;
}

interface StateMachine {
  states: string[];
  transitions: StateTransition[];
}

function parseAssignment(text: string): { name: string; value: string } | undefined {
  const match = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*=(?!=)\s*(.+?);?$/.exec(
    text.trim(),
  );
  if (!match) return undefined;
  const name = match[1] as string;
  const rhs = (match[2] ?? "").trim();
  const quoted = /^["'`]([^"'`]+)["'`]$/.exec(rhs);
  if (quoted) return { name, value: quoted[1] as string };
  if (/^-?\d+(?:\.\d+)?$/.test(rhs)) return { name, value: rhs };
  const member = /^[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)$/.exec(rhs);
  if (member) return { name, value: member[1] as string };
  return undefined;
}

function valueInLabel(label: string, states: readonly string[]): string | undefined {
  const quoted = /["'`]([^"'`]+)["'`]/.exec(label);
  if (quoted && states.includes(quoted[1] as string)) return quoted[1] as string;
  for (const state of states) {
    if (new RegExp(`\\b${state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(label)) {
      return state;
    }
  }
  return undefined;
}

function extractStateMachine(functions: readonly FunctionReport[]): StateMachine | undefined {
  const assignments: Array<{ name: string; value: string }> = [];
  const collect = (nodes: readonly FlowNode[]): void => {
    for (const node of nodes) {
      if (node.kind === "action" || node.kind === "terminator") {
        const assignment = parseAssignment(node.text);
        if (assignment) assignments.push(assignment);
      } else if (node.kind === "loop") {
        collect(node.body);
      } else {
        for (const branch of node.branches) collect(branch.body);
      }
    }
  };
  for (const fn of functions) collect(fn.flow);

  const counts = new Map<string, number>();
  for (const assignment of assignments) {
    counts.set(assignment.name, (counts.get(assignment.name) ?? 0) + 1);
  }
  let variable: string | undefined;
  let best = 0;
  for (const [name, count] of counts) {
    if (count > best) {
      best = count;
      variable = name;
    }
  }
  if (!variable) return undefined;

  const own = assignments.filter((assignment) => assignment.name === variable);
  const states = [...new Set(own.map((assignment) => assignment.value))];
  if (states.length < 2) return undefined;

  const transitions: StateTransition[] = [];
  const seen = new Set<string>();
  const push = (from: string, to: string, event: string): void => {
    const key = `${from}->${to}|${event}`;
    if (from === to || seen.has(key)) return;
    seen.add(key);
    transitions.push({ from, to, event });
  };
  const walk = (nodes: readonly FlowNode[], state: string, event: string): void => {
    let current = state;
    for (const node of nodes) {
      if (node.kind === "action" || node.kind === "terminator") {
        const assignment = parseAssignment(node.text);
        if (assignment && assignment.name === variable) {
          push(current, assignment.value, event);
          current = assignment.value;
        }
      } else if (node.kind === "loop") {
        walk(node.body, current, event);
      } else {
        for (const branch of node.branches) {
          const branchState = valueInLabel(branch.label, states);
          walk(branch.body, branchState ?? current, branchState ? branch.label : event);
        }
      }
    }
  };

  for (const fn of functions) {
    let start: string | undefined;
    const scanBranches = (nodes: readonly FlowNode[]): void => {
      for (const node of nodes) {
        if (start) return;
        if (node.kind === "loop") scanBranches(node.body);
        else if (node.kind === "decision") {
          for (const branch of node.branches) {
            const found = valueInLabel(branch.label, states);
            if (found) start = found;
            scanBranches(branch.body);
          }
        }
      }
    };
    scanBranches(fn.flow);
    walk(fn.flow, start ?? (own[0]?.value as string), "");
  }

  return { states, transitions };
}

export function stateMachineXml(
  owner: string,
  functions: readonly FunctionReport[],
): string {
  const machine = extractStateMachine(functions);
  if (!machine) return "";

  const ids = new Map(machine.states.map((state, index) => [state, `s${index}`]));
  const cells: string[] = ["mm_start"];
  cells.push(vertex("mm_start", "", "ellipse;html=1;fillColor=#3b4552;strokeColor=#3b4552;", 24, 24));

  for (const state of machine.states) {
    const id = ids.get(state) as string;
    const width = Math.min(240, Math.max(90, Math.ceil(textWidth([state])) + 30));
    cells.push(vertex(id, escapeAttrHtml(state), STYLE_NODE, width, 44));
  }
  cells.push(
    edge("e_start", "mm_start", ids.get(machine.states[0] as string) as string, STYLE_EDGE, owner),
  );

  let counter = 0;
  for (const transition of machine.transitions) {
    cells.push(
      edge(
        `t${counter++}`,
        ids.get(transition.from) as string,
        ids.get(transition.to) as string,
        "html=1;rounded=1;strokeColor=#3b4552;fontSize=11;",
        transition.event,
      ),
    );
  }

  return wrap(cells);
}
