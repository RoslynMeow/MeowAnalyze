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

export async function fileListToSources(
  files: readonly File[],
): Promise<SourceInput[]> {
  const sources: SourceInput[] = [];
  for (const file of files) {
    const relative = (file as File & { webkitRelativePath?: string })
      .webkitRelativePath;
    const path = relative && relative.length > 0 ? relative : file.name;
    if (isIgnoredPath(path)) continue;
    if (file.size > MAX_FILE_SIZE) continue;
    sources.push({ path, content: new Uint8Array(await file.arrayBuffer()) });
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

/** Let the user pick a project folder and read every analyzable file in it. */
export async function pickDirectory(): Promise<SourceInput[]> {
  const picker = (window as unknown as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("Directory picker is not supported by this browser.");
  const handle = await picker();
  const sources: SourceInput[] = [];
  await collectDirectory(handle, "", sources);
  sources.sort((a, b) => a.path.localeCompare(b.path));
  return sources;
}

async function collectDirectory(
  directory: DirectoryHandleLike,
  prefix: string,
  out: SourceInput[],
): Promise<void> {
  for await (const entry of directory.values()) {
    const path = prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name;
    if (isIgnoredPath(path)) continue;
    if (entry.kind === "directory") {
      await collectDirectory(entry, path, out);
      continue;
    }
    const file = await entry.getFile();
    if (file.size > MAX_FILE_SIZE) continue;
    out.push({ path, content: new Uint8Array(await file.arrayBuffer()) });
  }
}
