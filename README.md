<!-- Replace RoslynMeow with your GitHub username or organization. -->
<p align="center">
  <img src="./docs/assets/banner.svg" alt="MeowAnalyze" width="100%">
</p>

# MeowAnalyze

> A full-featured static code analyzer: language detection, cyclomatic complexity, nesting depth and more.

[![CI](https://github.com/RoslynMeow/MeowAnalyze/actions/workflows/ci.yml/badge.svg)](https://github.com/RoslynMeow/MeowAnalyze/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/RoslynMeow/MeowAnalyze?display_name=tag&sort=semver)](https://github.com/RoslynMeow/MeowAnalyze/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-1f6feb)](#-install)
[![Node](https://img.shields.io/badge/node-%3E%3D18-3fb950)](./package.json)

**English** | [简体中文](./README.zh-CN.md)

---

## ✨ Features

- **Language detection** per file (extension first, extensible to shebang / content heuristics).
- **Cyclomatic complexity** per function (decision points: `if`, loops, `case`, `catch`, `?:`, `&&`, `||`, `??`).
- **Cognitive complexity** (Sonar-style, nesting-weighted).
- **Nesting depth** per function.
- **Halstead metrics** and a **maintainability index** (per function, per file and averaged).
- **Markers**: `TODO` / `FIXME` / `HACK` counts, plus comment density.
- **Lines of code**: physical / code / comment / blank / logical.
- **Distribution aggregates** (`count` / `sum` / `min` / `max` / `mean`) for every metric, ready for charts and CI gates.
- **Configurable thresholds** with CI-friendly exit codes.
- **Multiple outputs**: a rich terminal report and stable JSON.
- **Browser-safe core** — no filesystem or process I/O in the analysis engine, so the same code powers the CLI, a desktop UI and a web app.

## 📦 Install

### Prebuilt binaries

Grab the binary for your platform from the [Releases](https://github.com/RoslynMeow/MeowAnalyze/releases) page — no Node.js required.

| Platform | Asset |
| --- | --- |
| Windows x64 | `meowanalyze-windows-x64.exe` |
| Linux x64 | `meowanalyze-linux-x64` |
| Linux arm64 | `meowanalyze-linux-arm64` |
| macOS x64 (Intel) | `meowanalyze-darwin-x64` |
| macOS arm64 (Apple Silicon) | `meowanalyze-darwin-arm64` |

```bash
chmod +x meowanalyze-linux-x64
./meowanalyze-linux-x64 .
```

> macOS binaries are unsigned. If Gatekeeper blocks them, run
> `xattr -d com.apple.quarantine meowanalyze-darwin-arm64`.

### From source

Requires Node.js >= 18.

```bash
git clone https://github.com/RoslynMeow/MeowAnalyze.git
cd MeowAnalyze
npm install
npm run dev -- .          # run against the current folder
npm run bundle            # -> dist/meowanalyze.cjs (single self-contained file)
npm run compile           # -> dist/meowanalyze(.exe) (standalone binary, needs Bun)
```

## 🚀 Quick start

```bash
# Analyze a folder (terminal report)
meowanalyze ./src

# Machine-readable output
meowanalyze ./src --format json > report.json

# Only summary tables
meowanalyze ./src --quiet

# Fail CI when a threshold is exceeded
meowanalyze ./src --fail-on warning
```

## 🌐 Web app

A static build of the browser app is attached to every release as `meowanalyze-web.zip`. Unzip it and serve the folder with any static server, or run it from source:

```bash
npm run dev:web            # dev server (http://localhost:5173)
npm run build:web          # static site -> apps/web/dist
npm run build:web:single   # one self-contained file -> apps/web/dist-single/index.html
```

**Publish:** `apps/web/dist` is a plain static site — host it on GitHub Pages, Cloudflare Pages, Netlify, Vercel or any web server. Once deployed, users just open the URL and use it; there is no backend. Every release also attaches `meowanalyze-web.zip` (the site) and `meowanalyze-web.html` (the single-file build).

**Embed / offline:** `meowanalyze-web.html` inlines all JavaScript, CSS and the banner into one file, so it works with no server at all — open it from disk, share a single file, or drop it into an `<iframe>`.

Open a project folder — the analysis core runs **entirely in your browser** and nothing is uploaded.

**Input:** open a project folder (File System Access API, with a `webkitdirectory` fallback). A thresholds panel re-runs the analysis live.

**Left-hand tabs** (with `#/dashboard` and `#/detail` hash routing):

1. **Dashboard** — a pure data screen: a maintainability index, twelve key numbers (files, functions, lines, comment %, average/max cyclomatic and cognitive complexity, Halstead difficulty, violations, markers) and pie charts only — lines of code, languages, and cyclomatic / cognitive / nesting / function-length / function-kind distributions, plus markers and violations-by-rule when present.
2. **File detail** — a file list with a source preview; click a function to scroll to and highlight its lines.

Pages scroll normally (no forced one-screen height), with a responsive layout, sortable tables and one-click JSON export.

## 🖥 Desktop app

The desktop app is **Electron** and reuses the web UI unchanged: it loads the built web app in the renderer and, in the main process, opens a native folder dialog and reads the files (no CLI subprocess).

```bash
npm run build:desktop   # build the web app + bundle the Electron main/preload
npm run start:desktop   # launch it (downloads the Electron binary on first run)
npm run dist:desktop    # package installers into apps/desktop/release
```

Installers (NSIS / dmg / AppImage + deb) are built per-OS in CI and attached to every release.

## 🛠 CLI reference

```
meowanalyze [path] [options]
```

| Option | Default | Description |
| --- | --- | --- |
| `[path]` | `.` | Directory or single file to analyze. |
| `-f, --format <format>` | `table` | Output format: `table` or `json`. |
| `-c, --config <file>` | auto | Path to a `meowanalyze.toml` config file. |
| `--no-gitignore` | honor | Do not honor `.gitignore`. |
| `-e, --exclude <patterns...>` | – | gitignore-style patterns to exclude. |
| `--top <count>` | `10` | Rows shown in the top / violation tables. |
| `--max-file-size <bytes>` | `2097152` | Skip files larger than this. |
| `--fail-on <level>` | `none` | Exit non-zero on `none` \| `warning` \| `error`. |
| `-q, --quiet` | – | Print only the summary tables. |
| `-v, --version` | – | Print the version. |

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success (and below the `--fail-on` level). |
| `1` | Violations at or above `--fail-on`. |
| `2` | Tool error (bad arguments, unreadable config, ...). |

## ⚙️ Configuration

Create `meowanalyze.toml` in the analyzed root (or pass `--config`):

```toml
[thresholds]
cyclomatic = 10      # max per function
nesting = 4          # max per function
params = 5           # max per function
function_loc = 80    # max lines per function
file_loc = 1000      # max lines per file

[analysis]
gitignore = true
exclude = ["**/*.test.ts", "**/*.d.ts"]
max_file_size = 2097152
```

## 🧩 JavaScript API

### `analyzeSources` — browser-safe core

The engine performs **no I/O**. Feed it in-memory sources and get a report. Ideal for a web app that reads a folder handle.

```ts
import { analyzeSources } from "@meowanalyze/core";

const report = analyzeSources({
  root: "my-project",                       // a label, not necessarily a real path
  sources: [
    { path: "src/index.ts", content: code }, // content: string | Uint8Array
  ],
  // config?, registry?, diagnostics?, now?, toolVersion?
});

console.log(report.summary.metrics.cyclomatic.max);
```

### `analyze` — Node host

Walks a directory (honoring `.gitignore`), reads files and delegates to the core.

```ts
import { analyze, loadConfig } from "@meowanalyze/cli";

const config = await loadConfig(undefined, process.cwd());
const report = await analyze({ root: process.cwd(), config });
```

### Custom languages

Implement the `LanguageAnalyzer` interface and register it. Adding a language never touches the engine.

```ts
import { LanguageRegistry, type LanguageAnalyzer } from "@meowanalyze/core";

class MyLang implements LanguageAnalyzer {
  readonly id = "mylang";
  readonly extensions = [".my"];
  matches(path: string) { return path.endsWith(".my"); }
  analyze(ctx) { /* return a FileReport */ }
}

const registry = new LanguageRegistry().register(new MyLang());
```

## 📊 Report schema

```jsonc
{
  "schemaVersion": "0.1.0",
  "toolVersion": "0.1.0",
  "root": "/abs/path",
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "durationMs": 42,
  "summary": {
    "files": 17,
    "filesByLanguage": { "typescript": 17 },
    "loc": { "physical": 1709, "code": 1469, "comment": 91, "blank": 149, "logical": 625 },
    "metrics": {
      "cyclomatic": { "count": 126, "sum": 279, "min": 1, "max": 16, "mean": 2.21 }
    },
    "violations": { "total": 2, "error": 0, "warning": 2, "info": 0 }
  },
  "files": [
    {
      "path": "src/index.ts",
      "language": "typescript",
      "loc": { "physical": 120, "code": 96, "comment": 8, "blank": 16, "logical": 44 },
      "metrics": { "cyclomatic": { "count": 9, "sum": 22, "min": 1, "max": 6, "mean": 2.44 } },
      "functions": [
        {
          "id": "src/index.ts:3:add",
          "name": "add",
          "kind": "function",
          "range": { "start": { "line": 3, "column": 1 }, "end": { "line": 5, "column": 2 } },
          "loc": 3,
          "params": 2,
          "cyclomatic": 1,
          "maxNesting": 0
        }
      ],
      "violations": []
    }
  ],
  "diagnostics": []
}
```

## 📐 Metrics

| Metric | Definition |
| --- | --- |
| **Cyclomatic complexity** | `1 + decision points` per function. Decision points: `if`, `for`, `for-in`, `for-of`, `while`, `do`, `case`, `catch`, `?:`, and `&&` / `\|\|` / `??`. |
| **Cognitive complexity** | Sonar-style, nesting-weighted score. Nesting increments for `if` / loops / `switch` / `catch` / `?:`, `else if` chains stay flat, and each sequence of like logical operators adds one. |
| **Nesting depth** | Maximum depth of nested control constructs (`if`, loops, `switch`, `try`) within a function. |
| **Halstead** | Distinct/total operators and operands, vocabulary, length, volume, difficulty and effort, scanned from the function text. |
| **Maintainability index** | `171 − 3.42·ln(V) − 0.23·CC − 16.2·ln(LOC)`, normalized to 0–100 (higher is better). Reported per function, per file and averaged. |
| **Comment density** | Share of non-blank lines that are comments. |
| **Markers** | Counts of `TODO` / `FIXME` / `HACK` in comments. |
| **Physical LOC** | Number of lines in the file. |
| **Code LOC** | Lines containing at least one non-comment token. |
| **Comment LOC** | Lines that only contain comments. |
| **Blank LOC** | Empty lines. `code + comment + blank === physical`. |
| **Logical LOC** | Number of statement nodes in the AST. |

## 🗂 Project layout

```
packages/
  core/      @meowanalyze/core      browser-safe engine (no fs): languages, metrics, report model
  cli/       @meowanalyze/cli       Node host: filesystem walk + terminal report + CLI
apps/
  web/       @meowanalyze/web       Vite web app running the core in the browser
  desktop/   @meowanalyze/desktop   Electron app that reuses the web build
docs/assets/banner.svg
```

The **core** is pure and platform-agnostic; hosts (CLI, web app, desktop app) only supply sources and render the report.

## 🗺 Roadmap

- [x] CLI with terminal + JSON output, thresholds and CI gating
- [x] Browser-safe core decoupled from the filesystem
- [x] Multi-platform standalone binaries via Bun
- [x] Web app (runs the core in the browser: open a project folder)
- [x] Desktop app (Electron, reusing the web UI)
- [ ] More languages via tree-sitter, cognitive complexity, Halstead & maintainability index

## 💻 Development

```bash
npm install
npm run dev -- <path>     # run the CLI from source
npm run dev:web           # run the web app from source
npm run build:desktop     # build the desktop app (web + Electron)
npm run typecheck         # type-check all packages
npm test                  # unit tests (Vitest)
npm run build             # build the core library
npm run build:web         # build the static web app
npm run bundle            # single-file CJS bundle
npm run compile           # standalone binary (requires Bun)
```

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## 📄 License

[MIT](./LICENSE) © MeowAnalyze contributors
