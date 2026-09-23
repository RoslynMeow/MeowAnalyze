import { button, el } from "../dom.js";
import { t } from "../i18n.js";
import { openLanguagePopover } from "../language-popover.js";
import {
  brandIcon,
  SUPPORTED_LANGUAGES,
  type LanguageGroup,
  type SupportedLanguage,
} from "../languages.js";

export interface LandingHandlers {
  onFolder: () => void;
  notice?: string;
}

/** Top to bottom: tuned, basic, files-only. */
const GROUPS: readonly LanguageGroup[] = ["tuned", "basic", "files"];

function languageChip(language: SupportedLanguage): HTMLElement {
  const chip = el(
    "button",
    { class: "lang-chip lang-chip--button", title: language.name },
    language.icon ? brandIcon(language.icon) : null,
    el("span", { class: "lang-chip__name", text: language.name }),
  );
  chip.type = "button";
  chip.addEventListener("click", () => openLanguagePopover(chip, language));
  return chip;
}

export function renderLanding(root: HTMLElement, handlers: LandingHandlers): void {
  root.replaceChildren();

  const blocks: HTMLElement[] = [];
  GROUPS.forEach((group, index) => {
    const languages = SUPPORTED_LANGUAGES.filter((language) => language.group === group);
    if (languages.length === 0) return;
    if (blocks.length > 0 && index > 0) {
      blocks.push(el("hr", { class: "landing__sep" }));
    }
    blocks.push(el("div", { class: "landing__langs" }, ...languages.map(languageChip)));
  });

  root.append(
    el(
      "div",
      { class: "view landing" },
      el(
        "div",
        { class: "landing__inner" },
        ...blocks,
        el(
          "div",
          { class: "landing__actions" },
          button(t().landing.openFolder, handlers.onFolder, "button--primary"),
        ),
        handlers.notice
          ? el("p", { class: "landing__notice", text: handlers.notice })
          : null,
      ),
    ),
  );
}
