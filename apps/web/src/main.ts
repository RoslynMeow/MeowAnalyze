import "./styles.css";
import {
  analyzeSources,
  DEFAULT_CONFIG,
  DEFAULT_THRESHOLDS,
  registryForPaths,
  type AnalysisReport,
  type SourceInput,
  type Thresholds,
} from "@meowanalyze/core";
import { button, downloadJson, el, icon, MENU_ICON, type ViewTargets } from "./dom.js";
import { getLang, onLangChange, setLang, t } from "./i18n.js";
import { getTheme, onThemeChange, setTheme } from "./theme.js";
import { renderSettings, type SettingsValues } from "./settings.js";
import { loadPrefs, savePrefs, type DashboardPrefs } from "./prefs.js";
import { chooseFolder } from "./platform.js";
import { disposeCharts } from "./echarts.js";
import { closeDrilldown, type DrillItem } from "./drilldown.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderDetail, type Highlight } from "./views/detail.js";
import { disposeDiagrams, renderDiagrams } from "./views/diagrams.js";
import { renderHelp } from "./views/help.js";
import { renderLanding } from "./views/landing.js";

const appEl = document.getElementById("app");
if (!appEl) throw new Error("missing #app");
const app: HTMLElement = appEl;

const TABS = ["dashboard", "detail", "diagrams", "help", "settings"] as const;
type Tab = (typeof TABS)[number];

const state: {
  sources: SourceInput[];
  root: string;
  report?: AnalysisReport;
  selectedPath?: string;
  highlight?: Highlight;
  thresholds: Thresholds;
  prefs: DashboardPrefs;
  tab: Tab;
} = {
  sources: [],
  root: "in-browser",
  thresholds: { ...DEFAULT_THRESHOLDS },
  prefs: loadPrefs(),
  tab: "dashboard",
};

let notice: string | undefined;

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

let headSlot: HTMLElement;
let content: HTMLElement;
let sidenav: HTMLElement;
let navBackdrop: HTMLElement;
let menuBtn: HTMLButtonElement;
let homeBtn: HTMLButtonElement;
let brand: HTMLElement;
let exportBtn: HTMLButtonElement;
let navOpen = false;
const navButtons: Array<{ tab: Tab; node: HTMLButtonElement }> = [];

function mountShell(): void {
  brand = el(
    "div",
    { class: "topbar__brand" },
    el("span", { class: "topbar__brand-accent", text: "Meow" }),
    el("span", { text: "Analyze" }),
  );

  menuBtn = el("button", { class: "topbar__home", onClick: () => setNavOpen(!navOpen) });
  menuBtn.type = "button";
  menuBtn.append(icon(MENU_ICON));
  menuBtn.hidden = true;

  headSlot = el("div", { class: "topbar__head" });
  const controls = el("div", { class: "controls" });
  const topbar = el(
    "header",
    { class: "topbar" },
    el("div", { class: "topbar__inner" }, menuBtn, brand, headSlot, controls),
  );

  sidenav = el("nav", { class: "sidenav" });
  navBackdrop = el("div", { class: "nav-backdrop", onClick: () => setNavOpen(false) });
  content = el("div", { class: "content" });
  const main = el("div", { class: "main" }, sidenav, navBackdrop, content);

  app.replaceChildren(topbar, main);
  mountControls(controls);
  mountSidenav();
  updateHomeLabel();
}

function setNavOpen(open: boolean): void {
  navOpen = open && !sidenav.hidden;
  sidenav.classList.toggle("sidenav--open", navOpen);
  navBackdrop.classList.toggle("nav-backdrop--open", navOpen);
}

function updateHomeLabel(): void {
  homeBtn.title = t().common.home;
  homeBtn.setAttribute("aria-label", t().common.home);
  menuBtn.title = t().common.menu;
  menuBtn.setAttribute("aria-label", t().common.menu);
}

function goHome(): void {
  state.report = undefined;
  state.sources = [];
  state.selectedPath = undefined;
  state.highlight = undefined;
  renderLandingView();
}

/* ------------------------------------------------------------------ */
/* Tabs + hash routing                                                 */
/* ------------------------------------------------------------------ */

function tabLabel(tab: Tab): string {
  if (tab === "settings") return t().common.settings;
  if (tab === "help") return t().common.help;
  return t().pages[tab];
}

const TOP_TABS: readonly Tab[] = ["dashboard", "detail", "diagrams"];

function makeTabButton(tab: Tab, className: string): HTMLButtonElement {
  const node = el("button", { class: className, text: tabLabel(tab) });
  node.type = "button";
  node.addEventListener("click", () => goTab(tab));
  navButtons.push({ tab, node });
  return node;
}

function mountSidenav(): void {
  navButtons.length = 0;

  const topButtons = TOP_TABS.map((tab) => makeTabButton(tab, "sidenav__item"));
  const helpBtn = makeTabButton("help", "sidenav__item sidenav__action");
  const settingsBtn = makeTabButton("settings", "sidenav__item sidenav__action");

  exportBtn = el("button", { class: "sidenav__item sidenav__action", onClick: exportReport });
  exportBtn.type = "button";

  homeBtn = el("button", { class: "sidenav__item sidenav__action", onClick: goHome });
  homeBtn.type = "button";

  sidenav.replaceChildren(
    ...topButtons,
    el("div", { class: "sidenav__spacer" }),
    helpBtn,
    settingsBtn,
    exportBtn,
    homeBtn,
  );
}

function applySettings(values: SettingsValues): void {
  state.thresholds = values.thresholds;
  state.prefs = values.prefs;
  savePrefs(values.prefs);
  void rerun();
}

function exportReport(): void {
  if (state.report) downloadJson(state.report, "meowanalyze-report.json");
}

function updateTabs(): void {
  for (const { tab, node } of navButtons) {
    const active = tab === state.tab;
    node.textContent = tabLabel(tab);
    node.classList.toggle("sidenav__item--active", active);
    node.setAttribute("aria-selected", active ? "true" : "false");
  }
  exportBtn.textContent = t().common.exportJson;
  homeBtn.textContent = t().common.home;
}

function tabFromHash(): Tab {
  const value = location.hash.replace(/^#\/?/, "");
  return (TABS as readonly string[]).includes(value) ? (value as Tab) : "dashboard";
}

function goTab(tab: Tab): void {
  state.tab = tab;
  setNavOpen(false);
  const hash = `#/${tab}`;
  if (location.hash !== hash) {
    location.hash = hash; // triggers hashchange -> render
  } else {
    renderContent();
  }
}

window.addEventListener("hashchange", () => {
  if (!state.report) return;
  state.tab = tabFromHash();
  renderContent();
});

/* ------------------------------------------------------------------ */
/* Landing                                                             */
/* ------------------------------------------------------------------ */

function renderLandingView(): void {
  closeDrilldown();
  disposeCharts();
  disposeDiagrams();
  sidenav.hidden = true;
  setNavOpen(false);
  brand.hidden = false;
  menuBtn.hidden = true;
  headSlot.replaceChildren();
  content.replaceChildren();
  renderLanding(content, {
    onFolder: () => void handleFolder(),
    notice,
  });
  notice = undefined;
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

function renderContent(): void {
  const report = state.report;
  if (!report) {
    renderLandingView();
    return;
  }

  sidenav.hidden = false;
  brand.hidden = true;
  menuBtn.hidden = false;
  closeDrilldown();
  disposeCharts();
  disposeDiagrams();
  content.replaceChildren();

  const body = el("div", { class: "page__body" });
  content.append(body);
  const targets: ViewTargets = { head: headSlot, body };

  if (state.tab === "detail") {
    renderDetail(targets, report, state.sources, state.selectedPath, {
      onSelect: selectFile,
    }, state.highlight);
  } else if (state.tab === "diagrams") {
    renderDiagrams(targets, report);
  } else if (state.tab === "help") {
    renderHelp(targets);
  } else if (state.tab === "settings") {
    renderSettings(
      targets,
      { thresholds: state.thresholds, prefs: state.prefs },
      { onApply: applySettings },
    );
  } else {
    renderDashboard(targets, report, { onJump: jumpToItem }, state.prefs, state.thresholds);
  }

  updateTabs();
}

function selectFile(path: string): void {
  state.selectedPath = path;
  state.highlight = undefined;
  goTab("detail");
}

function jumpToItem(item: DrillItem): void {
  state.selectedPath = item.file;
  state.highlight = item.line ? { line: item.line, endLine: item.endLine } : undefined;
  goTab("detail");
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

async function handleFolder(): Promise<void> {
  try {
    const { root, sources } = await chooseFolder();
    await runAnalysis(sources, root);
  } catch (error) {
    notice = error instanceof Error ? error.message : String(error);
    renderLandingView();
  }
}

async function runAnalysis(sources: SourceInput[], root: string): Promise<void> {
  // Only load the grammars this project actually needs (no wasm for TS/JS-only).
  const registry = await registryForPaths(sources.map((source) => source.path));
  const report = analyzeSources({
    root,
    sources,
    config: { ...DEFAULT_CONFIG, thresholds: state.thresholds },
    registry,
  });

  if (report.summary.files === 0) {
    notice = t().notices.noFiles;
    renderLandingView();
    return;
  }

  state.sources = sources;
  state.root = root;
  state.report = report;
  state.selectedPath = undefined;
  state.highlight = undefined;
  state.tab = "dashboard";
  if (location.hash !== "#/dashboard") location.hash = "#/dashboard";
  renderContent();
}

async function rerun(): Promise<void> {
  if (state.sources.length === 0) {
    renderLandingView();
    return;
  }
  const registry = await registryForPaths(
    state.sources.map((source) => source.path),
  );
  state.report = analyzeSources({
    root: state.root,
    sources: state.sources,
    config: { ...DEFAULT_CONFIG, thresholds: state.thresholds },
    registry,
  });
  renderContent();
}

/* ------------------------------------------------------------------ */
/* Top controls (theme + language)                                     */
/* ------------------------------------------------------------------ */

function controlButton(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const node = button(label, onClick);
  if (active) node.classList.add("control--active");
  return node;
}

function mountControls(container: HTMLElement): void {
  const themeGroup = el("div", { class: "control-group" });
  const langGroup = el("div", { class: "control-group" });

  const renderTheme = (): void => {
    themeGroup.replaceChildren(
      controlButton(t().theme.dark, getTheme() === "dark", () => setTheme("dark")),
      controlButton(t().theme.light, getTheme() === "light", () => setTheme("light")),
    );
  };
  const renderLang = (): void => {
    langGroup.replaceChildren(
      controlButton("中文", getLang() === "zh", () => setLang("zh")),
      controlButton("English", getLang() === "en", () => setLang("en")),
    );
  };

  renderTheme();
  renderLang();

  onThemeChange(() => {
    renderTheme();
    if (state.report) renderContent();
  });
  onLangChange(() => {
    renderLang();
    renderTheme();
    updateHomeLabel();
    if (state.report) {
      mountSidenav();
      renderContent();
    } else {
      renderLandingView();
    }
  });

  container.append(themeGroup, langGroup);
}

mountShell();
state.tab = tabFromHash();
renderLandingView();
