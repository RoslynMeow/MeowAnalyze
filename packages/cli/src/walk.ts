import { promises as fs } from "node:fs";
import path from "node:path";
import ignore from "ignore";

type Ignore = ReturnType<typeof ignore>;

export interface WalkOptions {
  /** Absolute path of the directory to walk. */
  root: string;
  respectGitignore: boolean;
  /** gitignore-style patterns to exclude, relative to root. */
  exclude: readonly string[];
  /** Files larger than this (bytes) are skipped. */
  maxFileSize: number;
}

export interface WalkedFile {
  absPath: string;
  /** Path relative to root, forward slashes. */
  relPath: string;
  size: number;
}

export const DEFAULT_IGNORES: readonly string[] = [
  ".git/",
  "node_modules/",
  "dist/",
  "build/",
  "out/",
  "coverage/",
  "vendor/",
];

/** Recursively list analyzable files, honoring .gitignore and excludes. */
export async function walkFiles(options: WalkOptions): Promise<WalkedFile[]> {
  const matcher = ignore();
  matcher.add(DEFAULT_IGNORES);
  matcher.add(options.exclude);

  if (options.respectGitignore) {
    await addGitignoreFile(matcher, options.root);
  }

  const out: WalkedFile[] = [];
  await walkDir(options.root, options.root, matcher, options, out);
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}

async function addGitignoreFile(
  matcher: Ignore,
  root: string,
): Promise<void> {
  try {
    const content = await fs.readFile(path.join(root, ".gitignore"), "utf8");
    matcher.add(content);
  } catch {
    // No .gitignore: nothing to add.
  }
}

async function walkDir(
  dir: string,
  root: string,
  matcher: Ignore,
  options: WalkOptions,
  out: WalkedFile[],
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const relPath = toPosix(path.relative(root, absPath));

    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      if (matcher.ignores(`${relPath}/`)) continue;
      await walkDir(absPath, root, matcher, options, out);
      continue;
    }

    if (!entry.isFile()) continue;
    if (matcher.ignores(relPath)) continue;

    let size: number;
    try {
      size = (await fs.stat(absPath)).size;
    } catch {
      continue;
    }
    if (size > options.maxFileSize) continue;

    out.push({ absPath, relPath, size });
  }
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}
