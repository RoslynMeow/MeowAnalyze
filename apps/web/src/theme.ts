export type Theme = "dark" | "light";

const STORAGE_KEY = "meowanalyze.theme";

let current: Theme = load();
const listeners = new Set<() => void>();

function load(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // storage unavailable — use the default
  }
  return "dark";
}

function apply(): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = current;
  }
}

export function initTheme(): void {
  apply();
}

export function getTheme(): Theme {
  return current;
}

export function setTheme(theme: Theme): void {
  if (theme === current) return;
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage failures
  }
  apply();
  for (const listener of listeners) listener();
}

export function toggleTheme(): void {
  setTheme(current === "dark" ? "light" : "dark");
}

export function onThemeChange(listener: () => void): void {
  listeners.add(listener);
}

initTheme();
