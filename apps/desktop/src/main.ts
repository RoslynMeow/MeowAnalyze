import { promises as fs } from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";

const IGNORED_SEGMENTS = new Set([
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

const MAX_FILE_SIZE = 2 * 1024 * 1024;

interface SourceInput {
  path: string;
  content: string;
}

interface ProjectSelection {
  root: string;
  sources: SourceInput[];
}

function isBinary(buffer: Buffer): boolean {
  const length = Math.min(buffer.length, 8000);
  for (let i = 0; i < length; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

/** Read every analyzable file under `root` into memory as text. */
async function readProject(root: string): Promise<SourceInput[]> {
  const out: SourceInput[] = [];

  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_SEGMENTS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join("/");

      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;

      try {
        const stat = await fs.stat(abs);
        if (stat.size > MAX_FILE_SIZE) continue;
        const bytes = await fs.readFile(abs);
        if (isBinary(bytes)) continue;
        out.push({ path: rel, content: bytes.toString("utf8") });
      } catch {
        // skip unreadable files
      }
    }
  };

  await walk(root);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

function webEntry(): string {
  // dist-electron/main.cjs -> ../dist-web/index.html
  return path.join(__dirname, "..", "dist-web", "index.html");
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0d1117",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  const devUrl = process.env.MEOW_WEB_URL;
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(webEntry());
  }
}

app.whenReady().then(() => {
  ipcMain.handle("meow:openFolder", async (): Promise<ProjectSelection> => {
    const window = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ["openDirectory"] })
      : await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) {
      return { root: "", sources: [] };
    }
    const root = result.filePaths[0] as string;
    return { root, sources: await readProject(root) };
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
