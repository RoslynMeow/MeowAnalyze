#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { loadConfig, type Config } from "./config.js";
import { analyze } from "./core/engine.js";
import type { AnalysisReport } from "./report/model.js";
import { toJson } from "./report/serialize.js";
import { renderReport } from "./report/table.js";
import { toolVersion } from "./version.js";

interface CliOptions {
  format: string;
  config?: string;
  gitignore: boolean;
  exclude?: string[];
  top: string;
  maxFileSize?: string;
  failOn: string;
  quiet?: boolean;
}

const program = new Command();

program
  .name("meowanalyze")
  .description(
    "Static code analyzer: language detection, cyclomatic complexity, nesting depth and more.",
  )
  .version(toolVersion(), "-v, --version")
  .argument("[path]", "directory or file to analyze", ".")
  .option("-f, --format <format>", "output format: table | json", "table")
  .option("-c, --config <file>", "path to a meowanalyze.toml config file")
  .option("--no-gitignore", "do not honor .gitignore")
  .option(
    "-e, --exclude <patterns...>",
    "gitignore-style patterns to exclude",
  )
  .option("--top <count>", "rows shown in top / violation tables", "10")
  .option("--max-file-size <bytes>", "skip files larger than this many bytes")
  .option("--fail-on <level>", "exit non-zero on: none | warning | error", "none")
  .option("-q, --quiet", "print only the summary tables")
  .action(async (pathArg: string, options: CliOptions) => {
    try {
      const root = path.resolve(pathArg);
      const config = await loadConfig(options.config, root);
      applyOverrides(config, options);

      const report = await analyze({ root, config });
      writeOutput(report, options);
      process.exitCode = exitCode(report, options.failOn);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`meowanalyze: ${message}\n`);
      process.exitCode = 2;
    }
  });

await program.parseAsync(process.argv);

function applyOverrides(config: Config, options: CliOptions): void {
  if (options.gitignore === false) config.respectGitignore = false;
  if (options.exclude && options.exclude.length > 0) {
    config.exclude = [...config.exclude, ...options.exclude];
  }
  if (options.maxFileSize !== undefined) {
    const size = Number.parseInt(options.maxFileSize, 10);
    if (Number.isFinite(size) && size > 0) config.maxFileSize = size;
  }
}

function writeOutput(report: AnalysisReport, options: CliOptions): void {
  if (options.format === "json") {
    process.stdout.write(`${toJson(report)}\n`);
    return;
  }
  if (options.format !== "table") {
    throw new Error(`unknown format '${options.format}' (expected 'table' or 'json')`);
  }
  const top = Number.parseInt(options.top, 10);
  const output = renderReport(report, {
    top: Number.isFinite(top) && top >= 0 ? top : 10,
    quiet: Boolean(options.quiet),
  });
  process.stdout.write(output);
}

function exitCode(report: AnalysisReport, failOn: string): number {
  const { error, warning } = report.summary.violations;
  const diagnosticErrors = report.diagnostics.filter(
    (d) => d.level === "error",
  ).length;

  switch (failOn) {
    case "error":
      return error + diagnosticErrors > 0 ? 1 : 0;
    case "warning":
      return error + warning + diagnosticErrors > 0 ? 1 : 0;
    case "none":
      return 0;
    default:
      throw new Error(`unknown --fail-on value '${failOn}' (expected none | warning | error)`);
  }
}
