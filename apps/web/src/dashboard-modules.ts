/**
 * Registry of dashboard modules. Each module is a card that opens the
 * drill-down drawer (chart + item list). A single list keeps the dashboard a
 * uniform wall of cards and the settings page a single set of toggles.
 */

export const MODULES = [
  { id: "maintainability", default: true },
  { id: "cyclomatic", default: true },
  { id: "cognitive", default: true },
  { id: "nesting", default: true },
  { id: "halsteadVolume", default: true },
  { id: "halsteadDifficulty", default: true },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];
