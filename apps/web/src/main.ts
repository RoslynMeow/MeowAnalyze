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
import { renderDashboard } from "./views/dashboard.js";
import { renderDetail } from "./views/detail.js";
import { renderLanding } from "./views/landing.js";

const appEl = document.getElementById("app");
if (!appEl) throw new Error("missing #app");
const app: HTMLElement = appEl;

const PAGE_KEYS = ["dashboard", "detail"] as const;
const PAGE_COUNT = PAGE_KEYS.length;

const state: {
  sources: SourceInput[];
  root: string;
  report?: AnalysisReport;
  selectedPath?: string;
  thresholds: Thresholds;
} = {
  sources: [],
  root: "in-browser",
  thresholds: { ...DEFAULT_THRESHOLDS },
};

let notice: string | undefined;

/* ------------------------------------------------------------------ */
/* Shell: top bar (page head + controls) above the content area        */
/* ------------------------------------------------------------------ */

let headSlot: HTMLElement;
let content: HTMLElement;
let homeBtn: HTMLButtonElement;

function mountShell(): void {
  homeBtn = el("button", { class: "topbar__home", onClick: goHome });
  homeBtn.type = "button";
  homeBtn.append(icon(HOME_ICON));
  homeBtn.hidden = true;

  headSlot = el("div", { class: "topbar__head" });
  const controls = el("div", { class: "controls" });
  const topbar = el(
    "header",
    { class: "topbar" },
    el("div", { class: "topbar__inner" }, homeBtn, headSlot, controls),
  );
  content = el("div", { class: "content" });
  app.replaceChildren(topbar, content);
  mountControls(controls);
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
  renderLandingView();
}

/* ------------------------------------------------------------------ */
/* Landing                                                             */
/* ------------------------------------------------------------------ */

function renderLandingView(): void {
  teardownPager();
  homeBtn.hidden = true;
  headSlot.replaceChildren();
  renderLanding(content, {
    onFolder: () => void handleFolder(),
    notice,
  });
  notice = undefined;
}

/* ------------------------------------------------------------------ */
/* Pager (full-height pages)                                           */
/* ------------------------------------------------------------------ */

let pager: HTMLElement | undefined;
let pages: HTMLElement[] = [];
let bodies: HTMLElement[] = [];
let heads: HTMLElement[] = [];
let dots: HTMLButtonElement[] = [];
let dotLabels: HTMLElement[] = [];
let nav: HTMLElement | undefined;
let currentPage = 0;

function mountPager(): void {
  teardownPager();

  pager = el("div", { class: "pager" });
  pages = [];
  bodies = [];
  heads = [];
  for (let index = 0; index < PAGE_COUNT; index++) {
    const body = el("div", { class: `page__body page__body--${PAGE_KEYS[index]}` });
    const section = el("section", { class: `page page--${PAGE_KEYS[index]}` }, body);
    pages.push(section);
    bodies.push(body);
    heads.push(el("div", { class: "page__head-slot" }));
  }
  pager.append(...pages);

  nav = el("nav", { class: "page-dots" });
  dots = [];
  dotLabels = [];
  PAGE_KEYS.forEach((_, index) => {
    const mark = el("span", { class: "page-dot__mark" });
    const label = el("span", { class: "page-dot__label" });
    const dot = el("button", { class: "page-dot" }, mark, label);
    dot.type = "button";
    dot.addEventListener("click", () => goToPage(index));
    dots.push(dot);
    dotLabels.push(label);
  });
  nav.append(...dots);

  content.replaceChildren(pager);
  app.append(nav);
  homeBtn.hidden = false;
  pager.addEventListener("scroll", onPagerScroll, { passive: true });
  document.addEventListener("keydown", onKeydown);

  renderPages();
}

function renderPages(): void {
  const report = state.report;
  if (!report || bodies.length === 0) return;

  renderDashboard({ head: heads[0]!, body: bodies[0]! }, report, {
    onOpenFile: selectFile,
    onExport: () => downloadJson(report, "meowanalyze-report.json"),
    onOpenSettings: () =>
      openSettings(state.thresholds, (thresholds) => {
        state.thresholds = thresholds;
        rerun();
      }),
  });

  renderDetailPage();
  showPageHead(currentPage);
  updateDots();
}

function renderDetailPage(): void {
  const report = state.report;
  if (!report || bodies.length === 0) return;
  const targets: ViewTargets = { head: heads[1]!, body: bodies[1]! };
  renderDetail(targets, report, state.sources, state.selectedPath, {
    onSelect: selectFile,
  });
}

function showPageHead(index: number): void {
  const head = heads[index];
  if (head) headSlot.replaceChildren(head);
}

function selectFile(path: string): void {
  state.selectedPath = path;
  renderDetailPage();
  goToPage(1);
}

function goToPage(index: number): void {
  const target = pages[index];
  if (!target) return;
  currentPage = index;
  showPageHead(index);
  updateDots();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function onPagerScroll(): void {
  if (!pager) return;
  const height = pager.clientHeight || 1;
  const page = Math.round(pager.scrollTop / height);
  if (page !== currentPage) {
    currentPage = page;
    showPageHead(page);
    updateDots();
  }
}

function updateDots(): void {
  dots.forEach((dot, index) => {
    const active = index === currentPage;
    dot.classList.toggle("page-dot--active", active);
    dot.title = t().pages[PAGE_KEYS[index] ?? "dashboard"];
    dot.setAttribute("aria-label", dot.title);
    dot.setAttribute("aria-current", active ? "true" : "false");
    const label = dotLabels[index];
    if (label) label.textContent = dot.title;
  });
}

function onKeydown(event: KeyboardEvent): void {
  if (!pager) return;
  const target = event.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

  switch (event.key) {
    case "ArrowDown":
    case "PageDown":
      event.preventDefault();
      goToPage(Math.min(PAGE_COUNT - 1, currentPage + 1));
      break;
    case "ArrowUp":
    case "PageUp":
      event.preventDefault();
      goToPage(Math.max(0, currentPage - 1));
      break;
    case "Home":
      event.preventDefault();
      goToPage(0);
      break;
    case "End":
      event.preventDefault();
      goToPage(PAGE_COUNT - 1);
      break;
    default:
      break;
  }
}

function teardownPager(): void {
  document.removeEventListener("keydown", onKeydown);
  nav?.remove();
  nav = undefined;
  pager = undefined;
  pages = [];
  bodies = [];
  heads = [];
  dots = [];
  dotLabels = [];
  currentPage = 0;
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
  mountPager();
}

function rerun(): void {
  if (state.sources.length === 0) {
    renderLandingView();
    return;
  }
  const report = analyzeSources({
    root: state.root,
    sources: state.sources,
    config: { ...DEFAULT_CONFIG, thresholds: state.thresholds },
  });
  state.report = report;
  if (pager) {
    renderPages();
    goToPage(currentPage);
  } else {
    mountPager();
  }
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

  onThemeChange(renderTheme);
  onLangChange(() => {
    renderLang();
    renderTheme();
    updateHomeLabel();
    if (state.report && pager) {
      renderPages();
      goToPage(currentPage);
    } else {
      renderLandingView();
    }
  });

  container.append(themeGroup, langGroup);
}

mountShell();
renderLandingView();
