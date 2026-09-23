/**
 * Tool version as a plain constant so the pure core can run anywhere
 * (Node, browser, WASM) without touching the filesystem.
 *
 * Must stay in sync with package.json — enforced by a test.
 */
export const TOOL_VERSION = "2.0.0";

export function toolVersion(): string {
  return TOOL_VERSION;
}
