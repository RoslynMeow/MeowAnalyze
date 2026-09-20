/**
 * Registry of dashboard modules. Each module is a card that opens the
 * drill-down drawer (chart + item list). A single list keeps the dashboard a
 * uniform wall of cards and the settings page a single set of toggles.
 */

export const MODULES = [
  { id: "maintainability", default: true },
  { id: "scale", default: true },
  { id: "cyclomatic", default: true },
  { id: "cognitive", default: true },
  { id: "nesting", default: true },
  { id: "functionLength", default: true },
  { id: "params", default: true },
  { id: "halsteadVolume", default: true },
  { id: "halsteadDifficulty", default: true },
  { id: "loc", default: true },
  { id: "logicalLines", default: true },
  { id: "commentPct", default: true },
  { id: "languages", default: true },
  { id: "functionKinds", default: true },
  { id: "markers", default: true },
  { id: "violations", default: true },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];
