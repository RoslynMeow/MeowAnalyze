/**
 * Lazy tree-sitter runtime. The runtime and grammar wasm are embedded as
 * base64(gzip) (see `scripts/embed-grammars.mjs`) so every build target — web,
 * desktop, CLI single-file and standalone binaries — ships them with no external
 * files to fetch.
 *
 * `Parser.init` / `Language.load` are async, but once a language is loaded
 * `parser.parse()` is synchronous. Hosts therefore call `loadLanguage()` before
 * `analyzeSources`, keeping the analysis engine itself synchronous.
 */
import Parser from "web-tree-sitter";
import {
  C_WASM_GZIP_BASE64,
  CPP_WASM_GZIP_BASE64,
  RUNTIME_WASM_GZIP_BASE64,
} from "./grammars.generated.js";

export type TreeSitterGrammar = "c" | "cpp";

const GRAMMAR_BASE64: Record<TreeSitterGrammar, string> = {
  c: C_WASM_GZIP_BASE64,
  cpp: CPP_WASM_GZIP_BASE64,
};

const loaded = new Map<TreeSitterGrammar, Parser.Language>();
let initPromise: Promise<void> | undefined;

async function inflate(base64: string): Promise<Uint8Array> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await Parser.init({ wasmBinary: await inflate(RUNTIME_WASM_GZIP_BASE64) });
    })();
  }
  return initPromise;
}

/** Load (and cache) a grammar. Safe to call repeatedly. */
export async function loadGrammar(
  grammar: TreeSitterGrammar,
): Promise<Parser.Language> {
  const cached = loaded.get(grammar);
  if (cached) return cached;
  await ensureInit();
  const language = await Parser.Language.load(await inflate(GRAMMAR_BASE64[grammar]));
  loaded.set(grammar, language);
  return language;
}

/** The grammar if it has already been loaded, otherwise undefined (sync). */
export function loadedGrammar(
  grammar: TreeSitterGrammar,
): Parser.Language | undefined {
  return loaded.get(grammar);
}

/** Load every grammar the core knows about. */
export async function loadAllGrammars(): Promise<void> {
  await Promise.all(
    (Object.keys(GRAMMAR_BASE64) as TreeSitterGrammar[]).map((grammar) =>
      loadGrammar(grammar),
    ),
  );
}
