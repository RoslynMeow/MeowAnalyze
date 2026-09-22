import type { AnalysisReport, FunctionReport } from "@meowanalyze/core";
import {
  activityDiagramXml,
  classDiagramXml,
  communicationDiagramXml,
  entityRelationshipXml,
  packageDiagramXml,
  sequenceDiagramXml,
  stateMachineXml,
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
import { faSvg, ICON_DOWNLOAD, ICON_EXPORT, ICON_RELOAD } from "../icons.js";
import { getTheme } from "../theme.js";

const KINDS: readonly DiagramKind[] = [
  "class",
  "package",
  "activity",
  "sequence",
  "state",
  "er",
  "communication",
];

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
  const owners = [...new Set(functions.map((fn) => fn.owner).filter((o): o is string => !!o))].sort();
  let kind: DiagramKind = "class";
  let selected = functions[0]?.id;

  const pickerOptions = (forKind: DiagramKind): Array<{ value: string; label: string }> => {
    if (forKind === "state") return owners.map((owner) => ({ value: owner, label: owner }));
    if (forKind === "activity" || forKind === "sequence") {
      return functions.map((fn) => ({
        value: fn.id,
        label: `${fn.name} · ${fn.id.split(":").slice(0, 2).join(":")}`,
      }));
    }
    return [];
  };

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
      case "sequence": {
        const fn = selected ? byId.get(selected) : undefined;
        return fn ? sequenceDiagramXml(fn) : "";
      }
      case "state": {
        if (!selected) return "";
        const owned = functions.filter((fn) => fn.owner === selected);
        return stateMachineXml(selected, owned);
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
  picker.addEventListener("change", () => {
    selected = picker.value;
    refresh();
  });

  const reloadBtn = actionButton(t().diagrams.reload, () => {
    active ? active.retry() : refresh();
  }, ICON_RELOAD);
  const downloadBtn = actionButton(t().diagrams.download, () => {
    const xml = xmlFor();
    if (xml) downloadFile(xml, "meowanalyze.drawio");
  }, ICON_DOWNLOAD);
  const exportBtn = actionButton(t().diagrams.exportSvg, () => active?.exportAs("svg"), ICON_EXPORT);

  const refresh = (): void => {
    const xml = xmlFor();
    kindButtons.forEach((node, index) =>
      node.classList.toggle("diagram-kind--active", KINDS[index] === kind),
    );

    const options = pickerOptions(kind);
    picker.hidden = options.length === 0;
    if (options.length > 0) {
      picker.replaceChildren(
        ...options.map((option) => {
          const node = document.createElement("option");
          node.value = option.value;
          node.textContent = option.label;
          return node;
        }),
      );
      if (!options.some((option) => option.value === selected)) selected = options[0]?.value;
      picker.value = selected ?? "";
    }

    const hasDiagram = xml.length > 0;
    downloadBtn.disabled = !hasDiagram;
    exportBtn.disabled = !hasDiagram;
    stage.classList.toggle("diagram-stage--empty", !hasDiagram);

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

function actionButton(
  label: string,
  onClick: () => void,
  icon?: Parameters<typeof faSvg>[0],
): HTMLButtonElement {
  const node = el("button", { class: "button button--ghost", text: label, title: label, onClick });
  node.type = "button";
  if (icon) {
    node.classList.add("button--icon");
    node.replaceChildren(faSvg(icon));
    node.setAttribute("aria-label", label);
  }
  return node;
}

function allFunctions(report: AnalysisReport): FunctionReport[] {
  return report.files.flatMap((file) => file.functions);
}
