import { el } from "./dom.js";
import { t } from "./i18n.js";
import { brandIcon, languageExtensions, type SupportedLanguage } from "./languages.js";

let current: HTMLElement | undefined;
let cleanup: (() => void) | undefined;

/** Close the language popover, if one is open. */
export function closeLanguagePopover(): void {
  cleanup?.();
  cleanup = undefined;
  current?.remove();
  current = undefined;
}

/** Open a floating panel with a language's detailed support info, near `anchor`. */
export function openLanguagePopover(
  anchor: HTMLElement,
  language: SupportedLanguage,
): void {
  closeLanguagePopover();

  const strings = t().languages;
  const tier = strings.tiers[language.group];

  const closeBtn = el("button", {
    class: "lang-pop__close",
    text: "✕",
    onClick: closeLanguagePopover,
  });
  closeBtn.type = "button";

  const pop = el(
    "div",
    { class: "lang-pop", title: strings.detailHint },
    el(
      "div",
      { class: "lang-pop__head" },
      language.icon ? brandIcon(language.icon, 18) : null,
      el("span", { class: "lang-pop__name", text: language.name }),
      el("span", {
        class: `lang-pop__tier lang-pop__tier--${language.group}`,
        text: tier.name,
      }),
      closeBtn,
    ),
    el("p", { class: "lang-pop__summary", text: tier.summary }),
    el(
      "div",
      { class: "lang-pop__ext" },
      el("span", { class: "lang-pop__label", text: strings.extensions }),
      el("span", {
        class: "lang-pop__value",
        text: languageExtensions(language.id).join("  ") || "—",
      }),
    ),
    el(
      "ul",
      { class: "lang-pop__features" },
      ...tier.features.map((feature) => el("li", { text: feature })),
    ),
  );

  pop.setAttribute("role", "dialog");
  document.body.append(pop);
  current = pop;

  // Position below the chip, clamped to the viewport; flip above if needed.
  const rect = anchor.getBoundingClientRect();
  const width = pop.offsetWidth;
  const height = pop.offsetHeight;
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
  let top = rect.bottom + 8;
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 8);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;

  const onPointerDown = (event: MouseEvent): void => {
    const target = event.target as Node;
    if (pop.contains(target) || anchor.contains(target)) return;
    closeLanguagePopover();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") closeLanguagePopover();
  };
  const onViewportChange = (): void => closeLanguagePopover();

  document.addEventListener("mousedown", onPointerDown, true);
  document.addEventListener("keydown", onKey);
  window.addEventListener("scroll", onViewportChange, true);
  window.addEventListener("resize", onViewportChange);
  cleanup = () => {
    document.removeEventListener("mousedown", onPointerDown, true);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange);
  };
}
