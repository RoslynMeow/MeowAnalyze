import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOL_VERSION } from "../src/version.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("version", () => {
  it("stays in sync with package.json", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(here, "..", "package.json"), "utf8"),
    ) as { version: string };
    expect(TOOL_VERSION).toBe(pkg.version);
  });
});
