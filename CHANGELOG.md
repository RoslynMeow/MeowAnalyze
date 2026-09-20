# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Desktop app (`@meowanalyze/desktop`): Electron, reusing the built web UI in
  the renderer. The main process opens a native folder dialog and reads files
  directly (no CLI subprocess); packaged as NSIS / dmg / AppImage + deb.
- Core metrics: cognitive complexity (Sonar-style, nesting-weighted), Halstead
  metrics and a maintainability index (per function, per file and averaged), plus
  `TODO` / `FIXME` / `HACK` marker counts. Surfaced in the JSON report, the CLI
  and the web app.
- Web: a settings modal for thresholds; a redesigned dashboard with a
  maintainability gauge, cognitive/cyclomatic histograms, a rule-violation chart,
  comment-density and marker KPIs; and more entrance/transition animations.
- Web: bilingual UI — Chinese by default with an English/中文 switcher persisted
  in `localStorage`.
- Web: a three-page, full-screen scroll-snap experience — a concise pie-chart
  dashboard, a nested file treemap (SpaceSniffer-style) and a file list with
  source preview — with page dots, arrow-key navigation and a responsive layout.
- Web: light/dark theme toggle (dark by default, persisted) and hidden
  scrollbars for a cleaner look.
- Web: page 1 is a pure data screen (equal-sized stat cards + pie charts); the
  most-complex-functions table moved to the file-map page. Responsive grids and
  `100dvh` sizing so each page fits the viewport.

### Planned

- Desktop UI (thin shell that wraps the platform CLI binary).
- More languages via tree-sitter, plus cognitive complexity, Halstead metrics and the maintainability index.

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

[Unreleased]: https://github.com/RoslynMeow/MeowAnalyze/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RoslynMeow/MeowAnalyze/releases/tag/v0.1.0
