import { button, el } from "../dom.js";

export interface LandingHandlers {
  bannerUrl: string;
  onFolder: () => void;
  notice?: string;
}

export function renderLanding(root: HTMLElement, handlers: LandingHandlers): void {
  root.replaceChildren();

  const banner = el("img", { class: "landing__banner" });
  banner.src = handlers.bannerUrl;
  banner.alt = "MeowAnalyze";

  const view = el(
    "div",
    { class: "view landing" },
    el(
      "div",
      { class: "landing__inner" },
      banner,
      el(
        "div",
        { class: "landing__actions" },
        button("Open folder", handlers.onFolder, "button--primary"),
      ),
      handlers.notice
        ? el("p", { class: "landing__notice", text: handlers.notice })
        : null,
    ),
  );

  root.append(view);
}
