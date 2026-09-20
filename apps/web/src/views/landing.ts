import { button, el } from "../dom.js";

export interface LandingHandlers {
  bannerUrl: string;
  onZip: (file: File) => void;
  onFolder: () => void;
  notice?: string;
}

export function renderLanding(root: HTMLElement, handlers: LandingHandlers): void {
  root.replaceChildren();

  const banner = el("img", { class: "landing__banner" });
  banner.src = handlers.bannerUrl;
  banner.alt = "MeowAnalyze";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".zip,application/zip";
  fileInput.hidden = true;
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) handlers.onZip(file);
    fileInput.value = "";
  });

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
        button("Upload .zip", () => fileInput.click(), "button--primary"),
        button("Open folder", handlers.onFolder),
      ),
      handlers.notice
        ? el("p", { class: "landing__notice", text: handlers.notice })
        : null,
      fileInput,
    ),
  );

  root.append(view);
}
