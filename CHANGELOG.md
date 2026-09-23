# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Maintainability index now uses the **Visual Studio / SEI coefficient (5.2)**
  instead of 3.42, so values are comparable with Visual Studio, NDepend, radon
  and other tools. (V/G/L definitions still differ slightly per tool.) Colour
  grading now uses the common 0–100 thresholds: < 65 red, 65–85 amber, ≥ 85 green.

### Added

- Core: the tree-sitter analyzers are now driven by a reusable `AnalyzerProfile`,
  and **Python** (`.py` / `.pyi`), **Java** (`.java`) and **C#** (`.cs`) are
  supported alongside C/C++ with the same metrics, thresholds, dashboard and
  diagrams.
- Core: **many more languages** — Go, Rust, Ruby, PHP, Kotlin, Swift, Scala, Lua,
  Zig, Solidity, Objective-C, Shell, Elixir, Emacs Lisp, OCaml, ReScript, TLA+,
  plus files/LOC for HTML, CSS, JSON, TOML, Vue, ERB and SystemRDL. Non-tuned
  languages use a generic profile and are documented as “basic”.
- Core: **Go** gets a dedicated profile (functions/methods with receiver owners,
  structs/interfaces with members, imports, calls, control flow) and is now a
  “tuned” language alongside C/C++, Python, Java and C#.
- Core: grammars are now loaded **on demand** (only the ones a project uses) from
  a dynamically-imported, bundled chunk, so TS/JS-only projects download no wasm.
  (dart, elm, ql and yaml grammars are omitted: their ABI is incompatible with
  the pinned runtime.)

- Web: the Diagrams tab embeds a **self-hosted draw.io** instead of
  `embed.diagrams.net`, so it no longer depends on a third party. The editor is
  fetched with `npm run drawio` into `apps/web/public/drawio` (gitignored,
  ~114 MB after pruning unused integrations/viewer bundles); the Pages and
  release workflows run it before building.

- C and C++ support via `web-tree-sitter` (WASM). The runtime and grammars are
  embedded as `base64(gzip)` so the parsers bundle into every target — web,
  desktop, the CLI single-file bundle and the standalone binaries — with no
  external files. C/C++ files get the same metrics as TypeScript (complexity,
  nesting, Halstead, maintainability, LOC, markers, imports, calls, control flow
  and declarations), so the dashboard, thresholds, CLI and diagrams all work.
  `defaultRegistryWithLanguages()` loads the grammars; the engine stays
  synchronous.

### Planned

- File map tab (nested treemap) — temporarily removed, to be re-added.
- More languages via tree-sitter (Go, Rust, Python, ...).

## [1.0.0] - 2026-09-22

### Added

- Core metrics: cognitive complexity (Sonar-style, nesting-weighted), Halstead
  metrics and a maintainability index (per function, per file and averaged), plus
  `TODO` / `FIXME` / `HACK` marker counts. Surfaced in the JSON report, the CLI
  and the web app. `FileMetrics` gains `halsteadDifficulty` and `halsteadEffort`.
- Core: per-language default thresholds (`DEFAULT_THRESHOLDS_BY_LANGUAGE`,
  `defaultThresholds()`, `resolveThresholds()`); `Config.thresholds` is now a
  partial override merged over the language defaults.
- OOP structure model: classes / interfaces / enums, imports and a static call
  graph, resolved across files.
- Web: UML diagrams (class, package, activity, sequence, state machine, ER,
  communication) rendered with the embedded draw.io editor, with `.drawio`
  download and SVG export.
- Web: redesigned dashboard (数据大屏) — a maintainability hero (ECharts gauge +
  marker / violation counters), a GitHub-style per-file heatmap coloured by
  health, a “needs attention” ranking, and a code-line / function-kind
  composition card. Remaining KPIs form a card wall; every card opens a
  drill-down drawer. ECharts is lazy-loaded (code-split).
- Web: the file-distribution header shows the project folder name, file count and
  language chips; the file detail tab previews source and highlights a function.
- Web: bilingual UI (Chinese by default) with an English/中文 switcher, and a
  light/dark theme toggle (dark by default); both persisted in `localStorage`.
- Desktop app (`@meowanalyze/desktop`): Electron, reusing the built web UI in the
  renderer. The main process opens a native folder dialog and reads files
  directly (no CLI subprocess); packaged as NSIS / dmg / AppImage + deb.
- CI: a GitHub Pages workflow that builds and deploys the web app on every push
  to `main` / `master`.
- Docs: bilingual README with Chinese as the default (`README.md`), English in
  `README.en.md`.

### Changed

- Default thresholds now follow common conventions (Sonar: cyclomatic 15,
  cognitive 15, params 7; ESLint `max-depth`: 4), and function / file length is
  measured in **code lines** instead of physical lines. The maintainability
  index uses the same line count.

## [0.1.0] - 2026-09-20

### Added

- Browser-safe analysis core (`@meowanalyze/core`): language detection, cyclomatic
  complexity, nesting depth and lines of code (physical / code / comment / blank / logical).
- `LanguageAnalyzer` extension point and `LanguageRegistry` so new languages never
  touch the engine.
- `Distribution` aggregates (`count` / `sum` / `min` / `max` / `mean`) for every metric.
- `analyzeSources` (pure, in-memory, no I/O) and `analyze` (Node filesystem host).
- CLI (`@meowanalyze/cli`) with a rich terminal report, stable JSON output,
  `.gitignore`-aware directory walking and configurable thresholds.
- Web app (`@meowanalyze/web`): Vite + TypeScript, runs the core entirely in the
  browser — open a project folder. Nothing is uploaded.
  Includes dependency-free SVG charts (complexity histogram, LOC/language donuts,
  top-functions bars, file treemap), sortable tables, a file filter and click-to-open
  interaction. Ships as a static site and as a single self-contained HTML file
  (offline / embeddable in an iframe).
- `meowanalyze.toml` configuration and `--fail-on` exit codes for CI gating.
- Standalone multi-platform binaries (Bun) and a single-file CJS bundle (esbuild).
- GitHub Actions: a CI workflow and a version-driven release workflow (no manual tags).
- Bilingual documentation and a project banner.

[Unreleased]: https://github.com/RoslynMeow/MeowAnalyze/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/RoslynMeow/MeowAnalyze/releases/tag/v1.0.0
[0.1.0]: https://github.com/RoslynMeow/MeowAnalyze/releases/tag/v0.1.0
