import { el, type Child, type ViewTargets } from "../dom.js";
import { t, type HelpSection } from "../i18n.js";
import { renderLatex, type LatexNode } from "../math.js";

/** Explain every metric and its formula, rendered from LaTeX. */
export function renderHelp(targets: ViewTargets): void {
  const strings = t();
  targets.head.replaceChildren(
    el(
      "header",
      { class: "page__head" },
      el("h1", { class: "page__title", text: strings.help.title }),
    ),
  );

  const pending: LatexNode[] = [];
  const sections = strings.help.sections.map((section) => sectionCard(section, pending));

  targets.body.replaceChildren(el("div", { class: "help-page" }, ...sections));

  void renderLatex(pending);
}

function sectionCard(section: HelpSection, pending: LatexNode[]): HTMLElement {
  const children: Child[] = [
    el("h2", { text: section.title }),
    el("p", { class: "card__hint", text: section.body }),
  ];

  if (section.items && section.items.length > 0) {
    children.push(
      el("ul", { class: "help-list" }, ...section.items.map((item) => el("li", { text: item }))),
    );
  }

  for (const latex of section.formulas ?? []) {
    const node = el("div", { class: "math", text: latex });
    pending.push({ node, latex });
    children.push(node);
  }

  if (section.note) {
    children.push(el("p", { class: "help-note", text: section.note }));
  }

  return el("section", { class: "card" }, ...children);
}
