// Downloads a pinned draw.io release and extracts the self-hosted `webapp` into
// `apps/web/public/drawio` so the Diagrams tab can load it from our own origin
// (no embed.diagrams.net). The extracted folder is gitignored and rebuilt on
// demand:
//
//   npm run drawio
//
// Unused payload is pruned: `integrate.min.js` (cloud integrations, ~21 MB),
// `WEB-INF` (servlet-side, ~5 MB) and the standalone viewer bundles (~7 MB),
// which the editor never loads.
import AdmZip from "adm-zip";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { get } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "v31.4.6";
const WAR_URL = `https://github.com/jgraph/drawio/releases/download/${VERSION}/draw.war`;

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "..", "apps", "web", "public", "drawio");
const versionFile = path.join(outDir, ".drawio-version");

const PRUNE = [
  "js/integrate.min.js",
  "js/viewer.min.js",
  "js/viewer-static.min.js",
  "js/orgchart.min.js",
  "WEB-INF",
  "META-INF",
];

function download(url, target) {
  return new Promise((resolve, reject) => {
    const request = get(url, { headers: { "user-agent": "meowanalyze-build" } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        download(response.headers.location, target).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`download failed: HTTP ${response.statusCode}`));
        return;
      }
      const file = createWriteStream(target);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    });
    request.on("error", reject);
  });
}

if (existsSync(versionFile) && readFileSync(versionFile, "utf8").trim() === VERSION) {
  console.log(`drawio ${VERSION} already extracted at ${path.relative(process.cwd(), outDir)}`);
  process.exit(0);
}

let war = process.env.DRAWIO_WAR;
if (war && existsSync(war)) {
  console.log(`using local war from DRAWIO_WAR=${war}`);
} else {
  war = path.join(tmpdir(), `drawio-${VERSION}.war`);
  const complete = existsSync(war) && statSync(war).size > 40_000_000;
  if (!complete) {
    console.log(`downloading drawio ${VERSION} (${WAR_URL}) ...`);
    await download(WAR_URL, war);
  }
}
console.log("extracting drawio webapp ...");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
new AdmZip(war).extractAllTo(outDir, true);

for (const relative of PRUNE) {
  rmSync(path.join(outDir, relative), { recursive: true, force: true });
}

writeFileSync(versionFile, VERSION);

function directorySize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? directorySize(full) : statSync(full).size;
  }
  return total;
}

console.log(
  `drawio ${VERSION} -> ${path.relative(process.cwd(), outDir)} (${(
    directorySize(outDir) / 1048576
  ).toFixed(1)} MB)`,
);
