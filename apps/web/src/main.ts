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
  decodeContent,
  fileListToSources,
  pickDirectory,
  supportsDirectoryPicker,
} from "./sources.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderDetail } from "./views/detail.js";
import { renderLanding } from "./views/landing.js";

const appEl = document.getElementById("app");
if (!appEl) throw new Error("missing #app");
const app: HTMLElement = appEl;

type View = "landing" | "dashboard" | "detail";

const state: {
  view: View;
  sources: SourceInput[];
  root: string;
  report?: AnalysisReport;
  filePath?: string;
  thresholds: Thresholds;
} = {
  view: "landing",
  sources: [],
  root: "in-browser",
  thresholds: { ...DEFAULT_THRESHOLDS },
};

let notice: string | undefined;

function render(): void {
  switch (state.view) {
    case "dashboard":
      renderDashboardView();
      break;
    case "detail":
      renderDetailView();
      break;
    default:
      renderLandingView();
  }
}

function renderLandingView(): void {
  state.view = "landing";
  renderLanding(app, {
    bannerUrl,
    onFolder: () => void handleFolder(),
    notice,
  });
  notice = undefined;
}

function renderDashboardView(): void {
  const report = state.report;
  if (!report) {
    renderLandingView();
    return;
  }
  state.view = "dashboard";
  renderDashboard(app, report, {
    onOpenFile: showDetail,
    onNewAnalysis: () => {
      state.report = undefined;
      state.sources = [];
      renderLandingView();
    },
    onExport: () => downloadJson(report, "meowanalyze-report.json"),
    onOpenSettings: () =>
      openSettings(state.thresholds, (thresholds) => {
        state.thresholds = thresholds;
        rerun();
      }),
  });
}

function renderDetailView(): void {
  const report = state.report;
  const path = state.filePath;
  if (!report || !path) {
    renderDashboardView();
    return;
  }
  const file = report.files.find((entry) => entry.path === path);
  if (!file) {
    renderDashboardView();
    return;
  }
  state.view = "detail";
  const source = state.sources.find((entry) => entry.path === path);
  renderDetail(app, file, source ? decodeContent(source.content) : undefined, {
    onBack: () => {
      state.filePath = undefined;
      renderDashboardView();
    },
  });
}

function showDetail(path: string): void {
  state.filePath = path;
  renderDetailView();
}

async function handleFolder(): Promise<void> {
  try {
    if (supportsDirectoryPicker()) {
      runAnalysis(await pickDirectory(), "folder");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory =
      true;
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
  state.filePath = undefined;
  renderDashboardView();
}

function rerun(): void {
  if (state.sources.length === 0) {
    renderLandingView();
    return;
  }
  runAnalysis(state.sources, state.root);
}

function mountLanguageSwitch(): void {
  const bar = el("div", { class: "lang-switch" });

  const update = (): void => {
    bar.replaceChildren(
      languageButton("中文", "zh"),
      languageButton("English", "en"),
    );
  };
  const languageButton = (label: string, lang: Lang): HTMLButtonElement => {
    const node = button(label, () => setLang(lang));
    if (getLang() === lang) node.classList.add("lang-switch__active");
    return node;
  };

  update();
  onLangChange(() => {
    update();
    render();
  });
  document.body.append(bar);
}

mountLanguageSwitch();
renderLandingView();
