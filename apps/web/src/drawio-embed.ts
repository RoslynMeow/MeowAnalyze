const EMBED_ORIGIN = "https://embed.diagrams.net";
// pwa=0 disables the service worker (a common source of embed errors).
const EMBED_URL = `${EMBED_ORIGIN}/?embed=1&ui=atlas&spin=1&proto=json&libraries=1&noSaveBtn=1&noExitBtn=1&modified=0&pwa=0`;

import type { LayoutSpec } from "./drawio.js";

export interface LoadOptions {
  layout?: string | readonly LayoutSpec[];
  dark?: boolean;
}

export interface EmbedHandlers {
  onExport?: (format: string, data: string) => void;
}

export interface DrawioEmbed {
  load(xml: string, options?: LoadOptions): void;
  exportAs(format: string): void;
  /** Reload the editor iframe (e.g. from a "reload" button). */
  retry(): void;
  dispose(): void;
}

/**
 * Embed the draw.io editor in an iframe and drive it over the JSON protocol.
 *
 * Messages are matched by `event.source === iframe.contentWindow` (enough when
 * posting to a specific window) and sent with a wildcard target origin,
 * following the official examples. There is no timeout: the editor loads when
 * it loads.
 */
export function createDrawioEmbed(
  container: HTMLElement,
  handlers: EmbedHandlers,
): DrawioEmbed {
  const iframe = document.createElement("iframe");
  iframe.className = "drawio-frame";
  iframe.title = "draw.io";
  iframe.setAttribute("allow", "clipboard-write; fullscreen");
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  container.append(iframe);

  let ready = false;
  let xml = "";
  let options: LoadOptions = {};

  const send = (message: Record<string, unknown>): void => {
    // Target a specific window, so the wildcard origin cannot leak elsewhere.
    iframe.contentWindow?.postMessage(JSON.stringify(message), "*");
  };

  const loadNow = (): void => {
    send({
      action: "load",
      xml,
      layout: options.layout,
      dark: options.dark ? 1 : 0,
      modified: 0,
      libs: "uml",
      fit: 1,
      maxFitScale: 1.5,
      border: 24,
    });
  };

  const onMessage = (event: MessageEvent): void => {
    if (event.source !== iframe.contentWindow) return;
    let data: unknown = event.data;
    if (typeof data === "string") {
      if (data === "ready") {
        ready = true;
        loadNow();
        return;
      }
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (!data || typeof data !== "object") return;
    const message = data as { event?: string; format?: string; data?: string };
    console.info("[meowanalyze] draw.io event:", message.event ?? data);

    if (message.event === "init") {
      ready = true;
      loadNow();
    } else if (message.event === "load") {
      // The layout runs after loading, so fit again to bring it all into view.
      send({ action: "fit", border: 24, maxScale: 1.5 });
    } else if (message.event === "export" && message.format && message.data) {
      handlers.onExport?.(message.format, message.data);
    }
  };

  const start = (): void => {
    ready = false;
    iframe.src = EMBED_URL;
  };

  window.addEventListener("message", onMessage);
  start();

  return {
    load(nextXml: string, nextOptions: LoadOptions = {}): void {
      xml = nextXml;
      options = nextOptions;
      if (ready) loadNow();
    },
    exportAs(format: string): void {
      send({ action: "export", format });
    },
    retry(): void {
      start();
    },
    dispose(): void {
      window.removeEventListener("message", onMessage);
      iframe.remove();
    },
  };
}

export function downloadDataUri(dataUri: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUri;
  link.download = filename;
  link.click();
}

export function downloadFile(text: string, filename: string, type = "application/xml"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
