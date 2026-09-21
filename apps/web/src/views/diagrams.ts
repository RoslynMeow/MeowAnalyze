import type { AnalysisReport, FunctionReport } from "@meowanalyze/core";
import {
  activityDiagramXml,
  classDiagramXml,
  communicationDiagramXml,
  entityRelationshipXml,
  packageDiagramXml,
  LAYOUT,
  type DiagramKind,
} from "../drawio.js";
import {
  createDrawioEmbed,
  downloadDataUri,
  downloadFile,
  type DrawioEmbed,
} from "../drawio-embed.js";
import { el, type ViewTargets } from "../dom.js";
import { t } from "../i18n.js";
import { getTheme } from "../theme.js";

const KINDS: readonly DiagramKind[] = ["class", "package", "activity", "er", "communication"];

let active: DrawioEmbed | undefined;

/** Tear down the embedded editor when leaving the tab. */
export function disposeDiagrams(): void {
  active?.dispose();
  active = undefined;
}

export function renderDiagrams(targets: ViewTargets, report: AnalysisReport): void {
  disposeDiagrams();

  targets.head.replaceChildren(
    el(
      "header",
      { class: "page__head" },
      el("h1", { class: "page__title", text: t().pages.diagrams }),
    ),
  );

  const functions = allFunctions(report);
  const byId = new Map(functions.map((fn) => [fn.id, fn]));
  let kind: DiagramKind = "class";
  let selected = functions[0]?.id;

  const notice = el("p", { class: "diagram-notice" });
  const stage = el("div", { class: "diagram-stage" }, notice);

  const xmlFor = (): string => {
    switch (kind) {
      case "class":
        return classDiagramXml(report.structure);
      case "package":
        return packageDiagramXml(report.structure);
      case "activity": {
        const fn = selected ? byId.get(selected) : undefined;
        return fn ? activityDiagramXml(fn) : "";
      }
      case "er":
        return entityRelationshipXml(report.structure);
      case "communication":
        return communicationDiagramXml(report.structure, byId);
    }
  };

  const kindButtons = KINDS.map((value) => {
    const node = el("button", {
      class: "diagram-kind",
      text: t().diagrams.kinds[value],
      onClick: () => {
        kind = value;
        refresh();
      },
    });
    node.type = "button";
    return node;
  });

  const picker = document.createElement("select");
  picker.className = "diagram-picker";
  for (const fn of functions) {
    const option = document.createElement("option");
    option.value = fn.id;
    option.textContent = `${fn.name} · ${fn.id.split(":").slice(0, 2).join(":")}`;
    picker.append(option);
  }
  picker.addEventListener("change", () => {
    selected = picker.value;
    refresh();
  });

  const reloadBtn = actionButton(t().diagrams.reload, () => {
    active ? active.retry() : refresh();
  });
  const downloadBtn = actionButton(t().diagrams.download, () => {
    const xml = xmlFor();
    if (xml) downloadFile(xml, "meowanalyze.drawio");
  });
  const exportBtn = actionButton(t().diagrams.exportSvg, () => active?.exportAs("svg"));

  const refresh = (): void => {
    const xml = xmlFor();
    kindButtons.forEach((node, index) =>
      node.classList.toggle("diagram-kind--active", KINDS[index] === kind),
    );
    picker.hidden = kind !== "activity";
    const hasDiagram = xml.length > 0;
    downloadBtn.disabled = !hasDiagram;
    exportBtn.disabled = !hasDiagram;

    if (!hasDiagram) {
      notice.hidden = false;
      notice.textContent = t().diagrams.empty[kind];
      return;
    }
    notice.hidden = true;

    if (!active) {
      active = createDrawioEmbed(stage, {
        onExport: (format, data) => downloadDataUri(data, `meowanalyze-diagram.${format}`),
      });
    }
    active.load(xml, { layout: LAYOUT[kind], dark: getTheme() === "dark" });
  };

  targets.body.replaceChildren(
    el(
      "div",
      { class: "diagram-page" },
      el(
        "header",
        { class: "diagram-toolbar" },
        el("div", { class: "diagram-kinds" }, ...kindButtons),
        picker,
        el("div", { class: "diagram-actions" }, reloadBtn, downloadBtn, exportBtn),
      ),
      el("div", { class: "diagram-stage-wrap" }, stage),
    ),
  );

  refresh();
}

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", { class: "button button--ghost", text: label, onClick });
  node.type = "button";
  return node;
}

function allFunctions(report: AnalysisReport): FunctionReport[] {
  return report.files.flatMap((file) => file.functions);
}
