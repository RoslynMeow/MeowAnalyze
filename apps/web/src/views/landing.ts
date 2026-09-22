import { button, el } from "../dom.js";
import { t } from "../i18n.js";
import { brandIcon, SUPPORTED_LANGUAGES } from "../languages.js";

export interface LandingHandlers {
  onFolder: () => void;
  notice?: string;
}

export function renderLanding(root: HTMLElement, handlers: LandingHandlers): void {
  root.replaceChildren();

  const languages = el(
    "div",
    { class: "landing__langs" },
    ...SUPPORTED_LANGUAGES.map((language) =>
      el(
        "span",
        { class: "lang-chip", title: language.name },
        brandIcon(language.icon),
        el("span", { class: "lang-chip__name", text: language.name }),
      ),
    ),
  );

  root.append(
    el(
      "div",
      { class: "view landing" },
      el(
        "div",
        { class: "landing__inner" },
        languages,
        button(t().landing.openFolder, handlers.onFolder, "button--primary"),
        handlers.notice
          ? el("p", { class: "landing__notice", text: handlers.notice })
          : null,
      ),
    ),
  );
}
