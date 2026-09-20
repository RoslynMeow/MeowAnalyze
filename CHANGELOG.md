# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  browser — drop a `.zip`, pick a folder or paste code. Nothing is uploaded.
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
