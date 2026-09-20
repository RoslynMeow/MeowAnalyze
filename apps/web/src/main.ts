import "./styles.css";
import {
  analyzeSources,
  DEFAULT_CONFIG,
  type Config,
  type SourceInput,
  type Thresholds,
} from "@meowanalyze/core";
import { renderReport } from "./render.js";
import {
  fileListToSources,
  pickDirectory,
  supportsDirectoryPicker,
  textToSource,
  zipToSources,
} from "./sources.js";

const state: { sources: SourceInput[]; root: string } = {
  sources: [],
  root: "in-browser",
};

const inputPanel = requireElement("input-panel");
const reportEl = requireElement("report");
const status = el("p", { class: "status", text: "Drop a .zip, pick a folder, or paste code." });

const thresholdInputs: Record<keyof Thresholds, HTMLInputElement> = {
  cyclomatic: numberInput(DEFAULT_CONFIG.thresholds.cyclomatic),
  nesting: numberInput(DEFAULT_CONFIG.thresholds.nesting),
  params: numberInput(DEFAULT_CONFIG.thresholds.params),
  functionLoc: numberInput(DEFAULT_CONFIG.thresholds.functionLoc),
  fileLoc: numberInput(DEFAULT_CONFIG.thresholds.fileLoc),
};

buildInputPanel(inputPanel);

function buildInputPanel(root: HTMLElement): void {
  const dropZone = el(
    "div",
    { class: "dropzone" },
    el("div", { class: "dropzone__title", text: "Drop a .zip archive here" }),
    el("div", {
      class: "dropzone__hint",
      text: "Everything is analyzed locally — nothing is uploaded.",
    }),
  );

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("over");
    void handleDrop(event.dataTransfer?.files);
  });

  const actions = el(
    "div",
    { class: "actions" },
    button("Choose folder", () => void handleChooseFolder()),
    button("Open .zip", () => openFilePicker()),
    button("Analyze pasted code", () => useSources(state.sources, state.root)),
  );

  const textarea = el("textarea", {
    class: "editor",
    title: "Paste code to analyze",
  });
  textarea.placeholder = "…or paste some TypeScript / JavaScript here";
  textarea.spellcheck = false;
  textarea.addEventListener("input", () => {
    if (textarea.value.trim().length === 0) return;
    state.sources = [textToSource(textarea.value, "pasted.ts")];
    state.root = "pasted";
  });

  const thresholds = el(
    "div",
    { class: "thresholds" },
    ...Object.entries(thresholdInputs).map(([key, input]) =>
      el(
        "label",
        { class: "threshold" },
        el("span", { text: key }),
        input,
      ),
    ),
    button("Re-analyze", () => useSources(state.sources, state.root)),
  );
  for (const input of Object.values(thresholdInputs)) {
    input.addEventListener("change", () => {
      if (state.sources.length > 0) useSources(state.sources, state.root);
    });
  }

  root.append(
    el("h1", { class: "title", text: "Analyze your code" }),
    dropZone,
    actions,
    textarea,
    el("details", { class: "config" }, el("summary", { text: "Thresholds" }), thresholds),
    status,
  );
}

function numberInput(value: number): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.value = String(value);
  return input;
}

function readThresholds(): Thresholds {
  return {
    cyclomatic: readNumber("cyclomatic"),
    nesting: readNumber("nesting"),
    params: readNumber("params"),
    functionLoc: readNumber("functionLoc"),
    fileLoc: readNumber("fileLoc"),
  };
}

function readNumber(key: keyof Thresholds): number {
  const value = Number.parseInt(thresholdInputs[key].value, 10);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_CONFIG.thresholds[key];
}

async function handleDrop(list: FileList | null | undefined): Promise<void> {
  const files = Array.from(list ?? []);
  if (files.length === 0) return;

  const zip = files.find((file) => file.name.toLowerCase().endsWith(".zip"));
  if (zip && files.length === 1) {
    setStatus(`Reading ${zip.name}…`);
    const sources = zipToSources(new Uint8Array(await zip.arrayBuffer()));
    useSources(sources, zip.name.replace(/\.zip$/i, ""));
    return;
  }

  const sources = await fileListToSources(files);
  useSources(sources, "dropped files");
}

function openFilePicker(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".zip,application/zip";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    void file.arrayBuffer().then((buffer) => {
      useSources(zipToSources(new Uint8Array(buffer)), file.name.replace(/\.zip$/i, ""));
    });
  });
  input.click();
}

async function handleChooseFolder(): Promise<void> {
  try {
    if (supportsDirectoryPicker()) {
      setStatus("Choose a folder…");
      const sources = await pickDirectory();
      useSources(sources, "folder");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    input.addEventListener("change", () => {
      if (!input.files) return;
      void fileListToSources(Array.from(input.files)).then((sources) =>
        useSources(sources, "folder"),
      );
    });
    input.click();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
}

function useSources(sources: SourceInput[], root: string): void {
  state.sources = sources;
  state.root = root;
  if (sources.length === 0) {
    setStatus("No analyzable files found (only TypeScript/JavaScript is supported for now).");
    reportEl.replaceChildren();
    return;
  }

  const config: Config = { ...DEFAULT_CONFIG, thresholds: readThresholds() };
  const report = analyzeSources({ root, sources, config });
  renderReport(reportEl, report);

  const analyzed = report.summary.files;
  if (analyzed === 0) {
    setStatus("No analyzable files found (only TypeScript/JavaScript is supported for now).");
  } else {
    setStatus(`Analyzed ${analyzed} file(s) — ${report.summary.metrics.cyclomatic.count} functions, ${report.summary.loc.code} code lines.`);
  }
}

function setStatus(message: string): void {
  status.textContent = message;
}

/* ------------------------------------------------------------------ */
/* tiny DOM helpers                                                    */
/* ------------------------------------------------------------------ */

type Child = Node | string | number | null | undefined;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string; title?: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.title) node.title = props.title;
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === "string" || typeof child === "number" ? String(child) : child);
  }
  return node;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", { class: "button", text: label });
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function requireElement(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node;
}
