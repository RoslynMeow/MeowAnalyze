import { readFileSync } from "node:fs";

/** Reads the version from the nearest package.json (works from src/ and dist/). */
export function toolVersion(): string {
  try {
    const url = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(url, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
