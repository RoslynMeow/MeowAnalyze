<!-- Replace RoslynMeow with your GitHub username or organization. -->
<p align="center">
  <img src="./docs/assets/banner.svg" alt="MeowAnalyze" width="100%">
</p>

<h1 align="center">MeowAnalyze</h1>

<p align="center">
  <strong>A full-featured static code analyzer</strong><br>
  language detection · cyclomatic &amp; cognitive complexity · nesting · Halstead · maintainability
</p>

<p align="center">
  <a href="https://roslynmeow.github.io/MeowAnalyze/"><img alt="Live demo" src="https://img.shields.io/badge/live%20demo-open%20in%20browser-ffb454?style=flat-square&logo=githubpages&logoColor=white"></a>
  <a href="https://github.com/RoslynMeow/MeowAnalyze/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/RoslynMeow/MeowAnalyze/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/RoslynMeow/MeowAnalyze/releases"><img alt="Release" src="https://img.shields.io/github/v/release/RoslynMeow/MeowAnalyze?display_name=tag&sort=semver&style=flat-square"></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-1f6feb?style=flat-square">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D18-3fb950?style=flat-square">
</p>

<p align="center"><a href="./README.md">简体中文</a> · <strong>English</strong></p>

---

MeowAnalyze reads a
**TypeScript / JavaScript / C / C++ / Python / Java / C#** project and reports the
numbers that predict maintenance pain: complexity, nesting, Halstead volume, a
maintainability index, comment density and technical-debt markers. The same
analysis core powers a **CLI**, a **web app** that runs entirely in your browser,
and an **Electron desktop app** — nothing is uploaded anywhere.

## Table of contents

- [Highlights](#highlights)
- [Try it online](#try-it-online)
- [Install](#install)
- [Web app](#web-app)
- [Desktop app](#desktop-app)
- [CLI reference](#cli-reference)
- [Configuration](#configuration)
- [JavaScript API](#javascript-api)
- [Metrics](#metrics)
- [Project layout](#project-layout)
- [Roadmap](#roadmap)
- [Development](#development)
- [License](#license)

## Highlights

- **Complexity** — cyclomatic and Sonar-style cognitive complexity, plus nesting
  depth, computed per function from the TypeScript compiler's AST.
- **Halstead & maintainability** — operators/operands, volume, difficulty, effort,
  and a normalized 0–100 maintainability index per function, per file and averaged.
- **Lines of code** — physical / code / comment / blank / logical, with
  `code + comment + blank === physical`.
- **Markers** — `TODO` / `FIXME` / `HACK` counts and comment density.
- **Distributions** — `count` / `sum` / `min` / `max` / `mean` for every metric,
  ready for charts and CI gates.
- **Thresholds & CI gating** — configurable limits with `--fail-on` exit codes.
- **Multiple outputs** — a rich terminal report and a stable JSON document.
- **Browser-safe core** — no filesystem or process I/O in the engine, so the same
  code runs in Node, the browser and (soon) WASM.

## Languages

TypeScript / JavaScript are parsed with the TypeScript compiler; every other
language uses tree-sitter (WASM). The grammars a project needs are loaded on
demand and bundled into every target, so nothing is fetched at runtime.

| Tier | Languages |
| --- | --- |
| **Tuned** — dedicated rules, all metrics trustworthy | TypeScript, JavaScript, C, C++, Python, Java, C# |
| **Basic** — generic tree-sitter rules (best effort; complexity / functions / lines work, but Halstead, cognitive complexity and class members may be incomplete) | Go, Rust, Ruby, PHP, Kotlin, Swift, Scala, Lua, Zig, Solidity, Objective-C, Shell, Elixir, Emacs Lisp, OCaml, ReScript, TLA+ |
| **Files / LOC only** — contributes files, code lines and language share | HTML, CSS, JSON, TOML, Vue, ERB, SystemRDL |

## Try it online

No install, no upload — the analysis runs locally in your browser:

> **https://roslynmeow.github.io/MeowAnalyze/**

Pick a project folder and explore the dashboard, per-file details, UML diagrams and
threshold settings.

## Install

### Prebuilt binaries

Grab the binary for your platform from the
[Releases](https://github.com/RoslynMeow/MeowAnalyze/releases) page — no Node.js
required.

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

## Web app

The web app is a **plain static site** with no backend — the analysis core runs
entirely in the browser and nothing is uploaded.

```bash
npm run dev:web            # dev server (http://localhost:5173)
npm run build:web          # static site -> apps/web/dist
npm run build:web:single   # one self-contained file -> apps/web/dist-single/index.html
```

**Pages**

1. **Dashboard** — a maintainability hero with a gauge and marker / violation
   counters, a GitHub-style **file heatmap** (one square per file, coloured by
   health, click to jump), a “needs attention” ranking, and a code-line /
   function-kind composition card. A card wall below adds cyclomatic and cognitive
   complexity, nesting depth, and Halstead volume / difficulty. Click any card to
   open a drill-down drawer; ECharts is lazy-loaded.
2. **File detail** — a file list with a source preview; click a function to scroll
   to and highlight its lines.
3. **Diagrams** — UML class, package, activity, sequence, state-machine, ER and
   communication diagrams, rendered with a **self-hosted draw.io** (no
   third-party request; download `.drawio`, export SVG). Fetch the editor once
   with `npm run drawio` before building.
4. **Help** — every metric with its formula, rendered as MathML.
5. **Settings** — thresholds and which dashboard cards are shown; the analysis
   re-runs live.

The UI is bilingual (Chinese / English), with a light / dark theme, all persisted
in `localStorage`. Open a project folder via the File System Access API (with a
`webkitdirectory` fallback).

**Publish:** `apps/web/dist` is a plain static site — host it on GitHub Pages,
Cloudflare Pages, Netlify, Vercel or any web server. This repo ships a
[Pages workflow](./.github/workflows/pages.yml) that builds and deploys the app on
every push to `main` / `master`. Every release also attaches
`meowanalyze-web.zip` (the site) and `meowanalyze-web.html` (the single-file build).

**Embed / offline:** `meowanalyze-web.html` inlines all JavaScript, CSS and the
banner into one file, so it works with no server at all — open it from disk, share
a single file, or drop it into an `<iframe>`.

## Desktop app

The desktop app is **Electron** and reuses the web UI unchanged: it loads the built
web app in the renderer and, in the main process, opens a native folder dialog and
reads the files (no CLI subprocess).

```bash
npm run build:desktop   # build the web app + bundle the Electron main/preload
npm run start:desktop   # launch it (downloads the Electron binary on first run)
npm run dist:desktop    # package installers into apps/desktop/release
```

Installers (NSIS / dmg / AppImage + deb) are built per-OS in CI and attached to
every release.

## CLI reference

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

## Configuration

Create `meowanalyze.toml` in the analyzed root (or pass `--config`):

```toml
[thresholds]
cyclomatic = 15      # max per function
cognitive = 15       # max per function
nesting = 4          # max per function
params = 7           # max per function
function_loc = 100   # max code lines per function
file_loc = 1000      # max code lines per file

[analysis]
gitignore = true
exclude = ["**/*.test.ts", "**/*.d.ts"]
max_file_size = 2097152
```

Defaults follow the common conventions (Sonar: cyclomatic 15, cognitive 15,
params 7; ESLint `max-depth`: 4). Unset fields fall back to the per-language
profile, so a new language can ship its own defaults without changing callers.

## JavaScript API

### `analyzeSources` — browser-safe core

The engine performs **no I/O**. Feed it in-memory sources and get a report. Ideal
for a web app that reads a folder handle.

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

Implement the `LanguageAnalyzer` interface and register it. Adding a language never
touches the engine.

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

## Metrics

| Metric | Definition |
| --- | --- |
| **Cyclomatic complexity** | `1 + decision points` per function. Decision points: `if`, `for`, `for-in`, `for-of`, `while`, `do`, `case`, `catch`, `?:`, and `&&` / `\|\|` / `??`. |
| **Cognitive complexity** | Sonar-style, nesting-weighted score. Nesting increments for `if` / loops / `switch` / `catch` / `?:`, `else if` chains stay flat, and each sequence of like logical operators adds one. |
| **Nesting depth** | Maximum depth of nested control constructs (`if`, loops, `switch`, `try`) within a function. |
| **Halstead** | Distinct/total operators and operands, vocabulary, length, volume, difficulty and effort, scanned from the function text. |
| **Maintainability index** | `171 − 3.42·ln(V) − 0.23·CC − 16.2·ln(L)` (normalized to 0–100, higher is better), where `L` is the function's code lines. Reported per function, per file and averaged. |
| **Comment density** | Share of non-blank lines that are comments. |
| **Markers** | Counts of `TODO` / `FIXME` / `HACK` in comments. |
| **Physical LOC** | Number of lines in the file. |
| **Code LOC** | Lines containing at least one non-comment token (also the unit for function / file length). |
| **Comment LOC** | Lines that only contain comments. |
| **Blank LOC** | Empty lines. `code + comment + blank === physical`. |
| **Logical LOC** | Number of statement nodes in the AST. |

## Project layout

```
packages/
  core/      @meowanalyze/core      browser-safe engine (no fs): languages, metrics, report model
  cli/       @meowanalyze/cli       Node host: filesystem walk + terminal report + CLI
apps/
  web/       @meowanalyze/web       Vite web app running the core in the browser
  desktop/   @meowanalyze/desktop   Electron app that reuses the web build
docs/assets/banner.svg
```

The **core** is pure and platform-agnostic; hosts (CLI, web app, desktop app) only
supply sources and render the report.

## Roadmap

- [x] CLI with terminal + JSON output, thresholds and CI gating
- [x] Browser-safe core decoupled from the filesystem
- [x] Multi-platform standalone binaries via Bun
- [x] Web app (runs the core in the browser: open a project folder)
- [x] Desktop app (Electron, reusing the web UI)
- [x] Cognitive complexity, Halstead metrics and a maintainability index
- [x] UML diagrams (draw.io) and an OOP structure model
- [x] One-click GitHub Pages deployment
- [x] 30+ languages via tree-sitter WASM, loaded on demand and bundled into every target
- [ ] Tune the generic (“basic”) language profiles

## Development

```bash
npm install
npm run dev -- <path>     # run the CLI from source
npm run dev:web           # run the web app from source
npm run build:desktop     # build the desktop app (web + Electron)
npm run typecheck         # type-check all packages
npm test                  # unit tests (Vitest)
npm run build             # build the core library
npm run build:web         # build the static web app
npm run drawio            # fetch the self-hosted draw.io editor (Diagrams tab)
npm run bundle            # single-file CJS bundle
npm run compile           # standalone binary (requires Bun)
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE) © MeowAnalyze contributors
