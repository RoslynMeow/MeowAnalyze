import "./styles.css";
import {
  analyzeSources,
  DEFAULT_CONFIG,
  DEFAULT_THRESHOLDS,
  type AnalysisReport,
  type SourceInput,
  type Thresholds,
} from "@meowanalyze/core";
import { button, downloadJson, el, icon, HOME_ICON, type ViewTargets } from "./dom.js";
import { getLang, onLangChange, setLang, t } from "./i18n.js";
import { getTheme, onThemeChange, setTheme } from "./theme.js";
import { openSettings } from "./settings.js";
import { chooseFolder } from "./platform.js";
import { disposeCharts } from "./echarts.js";
import { closeDrilldown, type DrillItem } from "./drilldown.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderDetail, type Highlight } from "./views/detail.js";
import { renderLanding } from "./views/landing.js";

const appEl = document.getElementById("app");
if (!appEl) throw new Error("missing #app");
const app: HTMLElement = appEl;

const TABS = ["dashboard", "detail"] as const;
type Tab = (typeof TABS)[number];

const state: {
  sources: SourceInput[];
  root: string;
  report?: AnalysisReport;
  selectedPath?: string;
  highlight?: Highlight;
  thresholds: Thresholds;
  tab: Tab;
} = {
  sources: [],
  root: "in-browser",
  thresholds: { ...DEFAULT_THRESHOLDS },
  tab: "dashboard",
};

let notice: string | undefined;

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

let headSlot: HTMLElement;
let content: HTMLElement;
let sidenav: HTMLElement;
let homeBtn: HTMLButtonElement;
let brand: HTMLElement;
let settingsBtn: HTMLButtonElement;
let exportBtn: HTMLButtonElement;
let tabButtons: HTMLButtonElement[] = [];

function mountShell(): void {
  brand = el(
    "div",
    { class: "topbar__brand" },
    el("span", { class: "topbar__brand-accent", text: "Meow" }),
    el("span", { text: "Analyze" }),
  );

  homeBtn = el("button", { class: "topbar__home", onClick: goHome });
  homeBtn.type = "button";
  homeBtn.append(icon(HOME_ICON));
  homeBtn.hidden = true;

  headSlot = el("div", { class: "topbar__head" });
  const controls = el("div", { class: "controls" });
  const topbar = el(
    "header",
    { class: "topbar" },
    el("div", { class: "topbar__inner" }, brand, homeBtn, headSlot, controls),
  );

  sidenav = el("nav", { class: "sidenav" });
  content = el("div", { class: "content" });
  const main = el("div", { class: "main" }, sidenav, content);

  app.replaceChildren(topbar, main);
  mountControls(controls);
  mountSidenav();
  updateHomeLabel();
}

function updateHomeLabel(): void {
  homeBtn.title = t().common.home;
  homeBtn.setAttribute("aria-label", t().common.home);
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

function mountSidenav(): void {
  tabButtons = TABS.map((tab) => {
    const node = el("button", { class: "sidenav__item", text: t().pages[tab] });
    node.type = "button";
    node.addEventListener("click", () => goTab(tab));
    return node;
  });

  settingsBtn = el("button", { class: "sidenav__item sidenav__action", onClick: openSettingsDialog });
  settingsBtn.type = "button";
  exportBtn = el("button", { class: "sidenav__item sidenav__action", onClick: exportReport });
  exportBtn.type = "button";

  sidenav.replaceChildren(
    ...tabButtons,
    el("div", { class: "sidenav__spacer" }),
    settingsBtn,
    exportBtn,
  );
}

function openSettingsDialog(): void {
  openSettings(state.thresholds, (thresholds) => {
    state.thresholds = thresholds;
    rerun();
  });
}

function exportReport(): void {
  if (state.report) downloadJson(state.report, "meowanalyze-report.json");
}

function updateTabs(): void {
  tabButtons.forEach((node, index) => {
    const tab = TABS[index];
    const active = tab === state.tab;
    node.textContent = t().pages[tab ?? "dashboard"];
    node.classList.toggle("sidenav__item--active", active);
    node.setAttribute("aria-selected", active ? "true" : "false");
  });
  settingsBtn.textContent = t().common.settings;
  exportBtn.textContent = t().common.exportJson;
}

function tabFromHash(): Tab {
  const value = location.hash.replace(/^#\/?/, "");
  return (TABS as readonly string[]).includes(value) ? (value as Tab) : "dashboard";
}

function goTab(tab: Tab): void {
  state.tab = tab;
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
  sidenav.hidden = true;
  brand.hidden = false;
  homeBtn.hidden = true;
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
  homeBtn.hidden = false;
  closeDrilldown();
  disposeCharts();
  content.replaceChildren();

  const body = el("div", { class: "page__body" });
  content.append(body);
  const targets: ViewTargets = { head: headSlot, body };

  if (state.tab === "detail") {
    renderDetail(targets, report, state.sources, state.selectedPath, {
      onSelect: selectFile,
    }, state.highlight);
  } else {
    renderDashboard(targets, report, { onJump: jumpToItem });
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
    runAnalysis(await chooseFolder(), "folder");
  } catch (error) {
    notice = error instanceof Error ? error.message : String(error);
    renderLandingView();
  }
}

function runAnalysis(sources: SourceInput[], root: string): void {
  const report = analyzeSources({
    root,
    sources,
    config: { ...DEFAULT_CONFIG, thresholds: state.thresholds },
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

function rerun(): void {
  if (state.sources.length === 0) {
    renderLandingView();
    return;
  }
  state.report = analyzeSources({
    root: state.root,
    sources: state.sources,
    config: { ...DEFAULT_CONFIG, thresholds: state.thresholds },
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
