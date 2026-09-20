import "./styles.css";
import bannerUrl from "../../../docs/assets/banner.svg";
import {
  analyzeSources,
  DEFAULT_CONFIG,
  DEFAULT_THRESHOLDS,
  type AnalysisReport,
  type SourceInput,
  type Thresholds,
} from "@meowanalyze/core";
import { button, downloadJson, el } from "./dom.js";
import { getLang, onLangChange, setLang, t, type Lang } from "./i18n.js";
import { openSettings } from "./settings.js";
import {
  fileListToSources,
  pickDirectory,
  supportsDirectoryPicker,
} from "./sources.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderDetail } from "./views/detail.js";
import { renderLanding } from "./views/landing.js";
import { renderTreemap } from "./views/treemap.js";

const appEl = document.getElementById("app");
if (!appEl) throw new Error("missing #app");
const app: HTMLElement = appEl;

const PAGE_KEYS = ["dashboard", "treemap", "detail"] as const;
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
let pager: HTMLElement | undefined;
let pages: HTMLElement[] = [];
let bodies: HTMLElement[] = [];
let dots: HTMLButtonElement[] = [];
let currentPage = 0;

/* ------------------------------------------------------------------ */
/* Landing                                                             */
/* ------------------------------------------------------------------ */

function renderLandingView(): void {
  teardownPager();
  app.classList.remove("app--pager");
  renderLanding(app, {
    bannerUrl,
    onFolder: () => void handleFolder(),
    notice,
  });
  notice = undefined;
}

/* ------------------------------------------------------------------ */
/* Pager (3 full-height pages)                                         */
/* ------------------------------------------------------------------ */

function mountPager(): void {
  teardownPager();

  pager = el("div", { class: "pager" });
  pages = [];
  bodies = [];
  for (let index = 0; index < PAGE_COUNT; index++) {
    const body = el("div", { class: `page__body page__body--${PAGE_KEYS[index]}` });
    const section = el("section", { class: "page" }, body);
    pages.push(section);
    bodies.push(body);
  }
  pager.append(...pages);

  const nav = el("nav", { class: "page-dots" });
  dots = PAGE_KEYS.map((_, index) => {
    const dot = el("button", { class: "page-dot" });
    dot.type = "button";
    dot.addEventListener("click", () => goToPage(index));
    return dot;
  });
  nav.append(...dots);

  app.replaceChildren(pager, nav);
  app.classList.add("app--pager");
  pager.addEventListener("scroll", onPagerScroll, { passive: true });
  document.addEventListener("keydown", onKeydown);

  renderPages();
}

function renderPages(): void {
  const report = state.report;
  if (!report || bodies.length === 0) return;

  renderDashboard(bodies[0]!, report, {
    onOpenFile: selectFile,
    onNewAnalysis: () => {
      state.report = undefined;
      state.sources = [];
      state.selectedPath = undefined;
      renderLandingView();
    },
    onExport: () => downloadJson(report, "meowanalyze-report.json"),
    onOpenSettings: () =>
      openSettings(state.thresholds, (thresholds) => {
        state.thresholds = thresholds;
        rerun();
      }),
  });

  renderTreemap(bodies[1]!, report, { onOpenFile: selectFile });
  renderDetailPage();
  updateDots();
}

function renderDetailPage(): void {
  const report = state.report;
  if (!report || bodies.length === 0) return;
  renderDetail(bodies[2]!, report, state.sources, state.selectedPath, {
    onSelect: selectFile,
  });
}

function selectFile(path: string): void {
  state.selectedPath = path;
  renderDetailPage();
  goToPage(2);
}

function goToPage(index: number): void {
  const target = pages[index];
  if (!target) return;
  currentPage = index;
  updateDots();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function onPagerScroll(): void {
  if (!pager) return;
  const height = pager.clientHeight || 1;
  const page = Math.round(pager.scrollTop / height);
  if (page !== currentPage) {
    currentPage = page;
    updateDots();
  }
}

function updateDots(): void {
  dots.forEach((dot, index) => {
    dot.classList.toggle("page-dot--active", index === currentPage);
    dot.title = t().pages[PAGE_KEYS[index] ?? "dashboard"];
    dot.setAttribute("aria-label", dot.title);
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
  pager = undefined;
  pages = [];
  bodies = [];
  dots = [];
  currentPage = 0;
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

async function handleFolder(): Promise<void> {
  try {
    if (supportsDirectoryPicker()) {
      runAnalysis(await pickDirectory(), "folder");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    input.addEventListener("change", () => {
      if (!input.files) return;
      void fileListToSources(Array.from(input.files)).then((sources) =>
        runAnalysis(sources, "folder"),
      );
    });
    input.click();
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
/* Language switch                                                     */
/* ------------------------------------------------------------------ */

function mountLanguageSwitch(): void {
  const bar = el("div", { class: "lang-switch" });

  const languageButton = (label: string, lang: Lang): HTMLButtonElement => {
    const node = button(label, () => setLang(lang));
    if (getLang() === lang) node.classList.add("lang-switch__active");
    return node;
  };
  const update = (): void => {
    bar.replaceChildren(languageButton("中文", "zh"), languageButton("English", "en"));
  };

  update();
  onLangChange(() => {
    update();
    if (state.report && pager) {
      renderPages();
      goToPage(currentPage);
    } else {
      renderLandingView();
    }
  });
  document.body.append(bar);
}

mountLanguageSwitch();
renderLandingView();
