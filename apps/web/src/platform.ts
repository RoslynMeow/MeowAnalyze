import {
  fileListToSources,
  pickDirectory,
  rootNameOf,
  supportsDirectoryPicker,
  type ProjectSelection,
} from "./sources.js";

/** Bridge exposed by the Electron preload script. */
export interface DesktopBridge {
  openFolder(): Promise<ProjectSelection>;
}

declare global {
  interface Window {
    meow?: DesktopBridge;
  }
}

export function isDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.meow?.openFolder === "function"
  );
}

/**
 * Pick a project folder. Uses the Electron bridge when running inside the
 * desktop app, then the File System Access API, then a `<input webkitdirectory>`
 * fallback.
 */
export async function chooseFolder(): Promise<ProjectSelection> {
  if (isDesktop()) {
    return (window.meow as DesktopBridge).openFolder();
  }
  if (supportsDirectoryPicker()) {
    return pickDirectory();
  }
  return chooseFolderWithInput();
}

function chooseFolderWithInput(): Promise<ProjectSelection> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory =
      true;
    input.addEventListener("change", () => {
      void fileListToSources(Array.from(input.files ?? [])).then((sources) =>
        resolve({ root: rootNameOf(sources), sources }),
      );
    });
    input.click();
  });
}
