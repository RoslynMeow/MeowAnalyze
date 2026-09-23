import { el, type Child, type ViewTargets } from "../dom.js";
import { t, type HelpSection } from "../i18n.js";
import { languageExtensions, languageIcon, SUPPORTED_LANGUAGES, type LanguageGroup } from "../languages.js";
import { renderLatex, type LatexNode } from "../math.js";

const LANGUAGE_GROUPS: readonly LanguageGroup[] = ["tuned", "basic", "files"];

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
  sections.push(languageSupportCard());

  targets.body.replaceChildren(el("div", { class: "help-page" }, ...sections));

  void renderLatex(pending);
}

/** Detailed per-tier language support, mirroring the landing-page popover. */
function languageSupportCard(): HTMLElement {
  const strings = t().languages;
  const blocks = LANGUAGE_GROUPS.map((group) => {
    const tier = strings.tiers[group];
    const languages = SUPPORTED_LANGUAGES.filter((language) => language.group === group);
    return el(
      "div",
      { class: "help-lang" },
      el(
        "div",
        { class: "help-lang__head" },
        el("span", {
          class: `help-lang__tier help-lang__tier--${group}`,
          text: tier.name,
        }),
        el("span", { class: "help-lang__summary", text: tier.summary }),
      ),
      el(
        "ul",
        { class: "help-list" },
        ...tier.features.map((feature) => el("li", { text: feature })),
      ),
      el(
        "div",
        { class: "help-lang__chips" },
        ...languages.map((language) =>
          el(
            "span",
            { class: "lang-chip", title: languageExtensions(language.id).join(" ") },
            languageIcon(language, 14),
            el("span", { class: "lang-chip__name", text: language.name }),
          ),
        ),
      ),
    );
  });

  return el("section", { class: "card" }, el("h2", { text: strings.title }), ...blocks);
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
