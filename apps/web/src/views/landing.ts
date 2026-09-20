import { button, el } from "../dom.js";
import { t } from "../i18n.js";

export interface LandingHandlers {
  onFolder: () => void;
  notice?: string;
}

export function renderLanding(root: HTMLElement, handlers: LandingHandlers): void {
  root.replaceChildren();

  root.append(
    el(
      "div",
      { class: "view landing" },
      el(
        "div",
        { class: "landing__inner" },
        button(t().landing.openFolder, handlers.onFolder, "button--primary"),
        handlers.notice
          ? el("p", { class: "landing__notice", text: handlers.notice })
          : null,
      ),
    ),
  );
}
