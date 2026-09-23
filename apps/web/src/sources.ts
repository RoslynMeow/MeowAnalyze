import type { SourceInput } from "@meowanalyze/core";

/** Directory names that are almost never worth analyzing. */
export const IGNORED_SEGMENTS: ReadonlySet<string> = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  "dist",
  "build",
  "out",
  "coverage",
  "vendor",
  ".next",
  ".cache",
  ".turbo",
]);

export const MAX_FILE_SIZE = 2 * 1024 * 1024;

export function isIgnoredPath(path: string): boolean {
  return path.split("/").some((segment) => IGNORED_SEGMENTS.has(segment));
}

/** A picked project: the best-available root plus its in-memory files. */
export interface ProjectSelection {
  /** Full path on the desktop, the folder name in the browser. */
  root: string;
  sources: SourceInput[];
}

/** Project name inferred from the first path segment of the selected files. */
export function rootNameOf(sources: readonly SourceInput[]): string {
  const segment = sources[0]?.path.split("/").filter(Boolean)[0];
  return segment ?? "folder";
}

/** Reports how many files have been read out of the total. */
export type ProgressFn = (done: number, total: number) => void;

export async function fileListToSources(
  files: readonly File[],
  onProgress?: ProgressFn,
): Promise<SourceInput[]> {
  const sources: SourceInput[] = [];
  const total = files.length;
  for (let index = 0; index < files.length; index++) {
    const file = files[index] as File;
    const relative = (file as File & { webkitRelativePath?: string })
      .webkitRelativePath;
    const path = relative && relative.length > 0 ? relative : file.name;
    if (!isIgnoredPath(path) && file.size <= MAX_FILE_SIZE) {
      sources.push({ path, content: new Uint8Array(await file.arrayBuffer()) });
    }
    onProgress?.(index + 1, total);
  }
  sources.sort((a, b) => a.path.localeCompare(b.path));
  return sources;
}

const textDecoder = new TextDecoder("utf-8");

/** Decode an in-memory source back to text (used to show the code panel). */
export function decodeContent(content: Uint8Array | string): string {
  const text =
    typeof content === "string" ? content : textDecoder.decode(content);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/* ------------------------------------------------------------------ */
/* File System Access API (Chromium browsers)                          */
/* ------------------------------------------------------------------ */

interface FileHandleLike {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}

interface DirectoryHandleLike {
  kind: "directory";
  name: string;
  values(): AsyncIterable<FileHandleLike | DirectoryHandleLike>;
}

interface PickerWindow {
  showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
}

export function supportsDirectoryPicker(): boolean {
  return typeof (window as unknown as PickerWindow).showDirectoryPicker === "function";
}

interface Target {
  handle: FileHandleLike;
  path: string;
}

/** Let the user pick a project folder and read every analyzable file in it. */
export async function pickDirectory(onProgress?: ProgressFn): Promise<ProjectSelection> {
  const picker = (window as unknown as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("Directory picker is not supported by this browser.");
  const handle = await picker();

  // List first so the total (and therefore a progress bar) is known before the
  // slower file reads begin.
  const targets: Target[] = [];
  await collectTargets(handle, "", targets);

  const sources: SourceInput[] = [];
  const total = targets.length;
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index] as Target;
    const file = await target.handle.getFile();
    if (file.size <= MAX_FILE_SIZE) {
      sources.push({ path: target.path, content: new Uint8Array(await file.arrayBuffer()) });
    }
    onProgress?.(index + 1, total);
  }
  sources.sort((a, b) => a.path.localeCompare(b.path));
  return { root: handle.name, sources };
}

async function collectTargets(
  directory: DirectoryHandleLike,
  prefix: string,
  out: Target[],
): Promise<void> {
  for await (const entry of directory.values()) {
    const path = prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name;
    if (isIgnoredPath(path)) continue;
    if (entry.kind === "directory") {
      await collectTargets(entry, path, out);
      continue;
    }
    out.push({ handle: entry, path });
  }
}
