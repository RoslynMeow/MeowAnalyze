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

const MIN_WAR_BYTES = 40_000_000;

function getStream(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      { headers: { "user-agent": "meowanalyze-build" }, timeout: 60_000 },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location && redirects < 5) {
          response.resume();
          getStream(response.headers.location, redirects + 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(new Error(`download failed: HTTP ${status}`));
          return;
        }
        resolve(response);
      },
    );
    request.on("timeout", () => request.destroy(new Error("download timed out")));
    request.on("error", reject);
  });
}

async function downloadOnce(url, target) {
  const response = await getStream(url);
  await new Promise((resolve, reject) => {
    const file = createWriteStream(target);
    response.pipe(file);
    file.on("finish", () => file.close(() => resolve()));
    file.on("error", reject);
    response.on("error", reject);
  });
  const size = statSync(target).size;
  if (size < MIN_WAR_BYTES) {
    throw new Error(`downloaded war is too small (${size} bytes)`);
  }
}

/** Retries a few times — CI runners occasionally time out reaching GitHub. */
async function download(url, target) {
  const attempts = 4;
  for (let attempt = 1; ; attempt++) {
    try {
      await downloadOnce(url, target);
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      const wait = attempt * 5000;
      console.warn(
        `download failed (${error instanceof Error ? error.message : error}); retry ${attempt}/${
          attempts - 1
        } in ${wait}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
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
  const complete = existsSync(war) && statSync(war).size > MIN_WAR_BYTES;
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
