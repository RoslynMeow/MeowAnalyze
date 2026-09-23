/**
 * On-demand tree-sitter runtime. The runtime and grammar wasm are embedded as
 * base64(gzip) (see `scripts/embed-grammars.mjs`) in a module that is imported
 * dynamically, so bundlers split it into its own chunk: TS/JS-only projects
 * never download it, and only the grammars a project actually uses are
 * decompressed and instantiated.
 *
 * `Parser.init` / `Language.load` are async, but once a language is loaded
 * `parser.parse()` is synchronous. Hosts load the grammars a project needs
 * before calling `analyzeSources`, which keeps the analysis engine synchronous.
 */
import Parser from "web-tree-sitter";

export type TreeSitterGrammar = string;

type GrammarModule = typeof import("./grammars.generated.js");

let modulePromise: Promise<GrammarModule> | undefined;
const loaded = new Map<string, Parser.Language>();
let initPromise: Promise<void> | undefined;

function loadModule(): Promise<GrammarModule> {
  modulePromise ??= import("./grammars.generated.js");
  return modulePromise;
}

async function inflate(base64: string): Promise<Uint8Array> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const { RUNTIME_WASM_GZIP_BASE64 } = await loadModule();
      await Parser.init({ wasmBinary: await inflate(RUNTIME_WASM_GZIP_BASE64) });
    })();
  }
  return initPromise;
}

/** Load (and cache) a grammar. Safe to call repeatedly. */
export async function loadGrammar(grammar: TreeSitterGrammar): Promise<Parser.Language> {
  const cached = loaded.get(grammar);
  if (cached) return cached;
  await ensureInit();
  const { GRAMMARS } = await loadModule();
  const base64 = GRAMMARS[grammar];
  if (!base64) throw new Error(`no embedded grammar for "${grammar}"`);
  const language = await Parser.Language.load(await inflate(base64));
  loaded.set(grammar, language);
  return language;
}

/** The grammar if it has already been loaded, otherwise undefined (sync). */
export function loadedGrammar(grammar: TreeSitterGrammar): Parser.Language | undefined {
  return loaded.get(grammar);
}
