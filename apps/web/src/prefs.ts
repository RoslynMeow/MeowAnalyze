import { MODULES } from "./dashboard-modules.js";

/** Which dashboard modules are shown. */
export interface DashboardPrefs {
  modules: Record<string, boolean>;
}

const STORAGE_KEY = "meowanalyze.dashboard";

export function defaultPrefs(): DashboardPrefs {
  const modules: Record<string, boolean> = {};
  for (const module of MODULES) modules[module.id] = module.default;
  return { modules };
}

export function loadPrefs(): DashboardPrefs {
  const base = defaultPrefs();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<DashboardPrefs>;
    return { modules: { ...base.modules, ...prune(parsed.modules, base.modules) } };
  } catch {
    return base;
  }
}

export function savePrefs(prefs: DashboardPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage failures
  }
}

/** Keep only known ids with boolean values, so stale storage never leaks in. */
function prune(
  saved: unknown,
  base: Record<string, boolean>,
): Record<string, boolean> {
  if (typeof saved !== "object" || saved === null) return {};
  const out: Record<string, boolean> = {};
  for (const key of Object.keys(base)) {
    const value = (saved as Record<string, unknown>)[key];
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}
