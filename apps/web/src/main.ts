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
import { downloadJson } from "./dom.js";
import {
  decodeContent,
  fileListToSources,
  pickDirectory,
  supportsDirectoryPicker,
  zipToSources,
} from "./sources.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderDetail } from "./views/detail.js";
import { renderLanding } from "./views/landing.js";

const appEl = document.getElementById("app");
if (!appEl) throw new Error("missing #app");
const app: HTMLElement = appEl;

const state: {
  sources: SourceInput[];
  root: string;
  report?: AnalysisReport;
  thresholds: Thresholds;
} = {
  sources: [],
  root: "in-browser",
  thresholds: { ...DEFAULT_THRESHOLDS },
};

let notice: string | undefined;

function showLanding(): void {
  renderLanding(app, {
    bannerUrl,
    onZip: (file) => void handleZip(file),
    onFolder: () => void handleFolder(),
    notice,
  });
  notice = undefined;
}

function showDashboard(): void {
  const report = state.report;
  if (!report) {
    showLanding();
    return;
  }
  renderDashboard(app, report, {
    thresholds: state.thresholds,
    onOpenFile: showDetail,
    onNewAnalysis: () => {
      state.report = undefined;
      state.sources = [];
      showLanding();
    },
    onExport: () => downloadJson(report, "meowanalyze-report.json"),
    onThresholdsChange: (thresholds) => {
      state.thresholds = thresholds;
      rerun();
    },
  });
}

function showDetail(path: string): void {
  const report = state.report;
  if (!report) {
    showLanding();
    return;
  }
  const file = report.files.find((entry) => entry.path === path);
  if (!file) {
    showDashboard();
    return;
  }
  const source = state.sources.find((entry) => entry.path === path);
  renderDetail(app, file, source ? decodeContent(source.content) : undefined, {
    onBack: showDashboard,
  });
}

async function handleZip(file: File): Promise<void> {
  const sources = zipToSources(new Uint8Array(await file.arrayBuffer()));
  runAnalysis(sources, file.name.replace(/\.zip$/i, ""));
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
    showLanding();
  }
}

function runAnalysis(sources: SourceInput[], root: string): void {
  const report = analyzeSources({
    root,
    sources,
    config: { ...DEFAULT_CONFIG, thresholds: state.thresholds },
  });

  if (report.summary.files === 0) {
    notice = "No TypeScript / JavaScript files found.";
    showLanding();
    return;
  }

  state.sources = sources;
  state.root = root;
  state.report = report;
  showDashboard();
}

function rerun(): void {
  if (state.sources.length === 0) {
    showLanding();
    return;
  }
  runAnalysis(state.sources, state.root);
}

showLanding();
