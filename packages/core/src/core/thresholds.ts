import type { Thresholds } from "../config/thresholds.js";
import type { FileReport, Range, Violation } from "../report/model.js";

/**
 * Turn a file report into violations by comparing measured values against the
 * configured thresholds. Kept separate from analysis so the analyzer stays
 * policy-free and the same metrics can back different rule sets later.
 */
export function applyThresholds(
  file: FileReport,
  thresholds: Thresholds,
): Violation[] {
  const violations: Violation[] = [];

  for (const fn of file.functions) {
    check(
      violations,
      "cyclomatic",
      fn.cyclomatic,
      thresholds.cyclomatic,
      fn.range,
      fn.id,
      `function '${fn.name}' has cyclomatic complexity ${fn.cyclomatic} (max ${thresholds.cyclomatic})`,
    );
    check(
      violations,
      "nesting",
      fn.maxNesting,
      thresholds.nesting,
      fn.range,
      fn.id,
      `function '${fn.name}' nests ${fn.maxNesting} levels deep (max ${thresholds.nesting})`,
    );
    check(
      violations,
      "params",
      fn.params,
      thresholds.params,
      fn.range,
      fn.id,
      `function '${fn.name}' takes ${fn.params} parameters (max ${thresholds.params})`,
    );
    check(
      violations,
      "function-loc",
      fn.loc,
      thresholds.functionLoc,
      fn.range,
      fn.id,
      `function '${fn.name}' is ${fn.loc} lines long (max ${thresholds.functionLoc})`,
    );
  }

  check(
    violations,
    "file-loc",
    file.loc.physical,
    thresholds.fileLoc,
    fileRange(file),
    undefined,
    `file is ${file.loc.physical} lines long (max ${thresholds.fileLoc})`,
  );

  return violations;
}

function check(
  out: Violation[],
  rule: string,
  actual: number,
  limit: number,
  location: Range,
  functionId: string | undefined,
  message: string,
): void {
  if (actual <= limit) return;
  const violation: Violation = {
    rule,
    level: "warning",
    actual,
    limit,
    location,
    message,
  };
  if (functionId !== undefined) violation.functionId = functionId;
  out.push(violation);
}

function fileRange(file: FileReport): Range {
  return {
    start: { line: 1, column: 1 },
    end: { line: Math.max(1, file.loc.physical), column: 1 },
  };
}
