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

export type TreeSitterGrammar = "c" | "cpp";

/**
 * The embedded wasm lives in a separate module and is loaded with a dynamic
 * `import()`, so bundlers split it into its own chunk: TS/JS-only projects never
 * download or decompress it, and a project that only has C files never pays for
 * the (larger) C++ grammar.
 */
type GrammarModule = typeof import("./grammars.generated.js");

const loaded = new Map<TreeSitterGrammar, Parser.Language>();
let grammarModule: Promise<GrammarModule> | undefined;
let initPromise: Promise<void> | undefined;

function loadGrammarModule(): Promise<GrammarModule> {
  grammarModule ??= import("./grammars.generated.js");
  return grammarModule;
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
      const { RUNTIME_WASM_GZIP_BASE64 } = await loadGrammarModule();
      await Parser.init({ wasmBinary: await inflate(RUNTIME_WASM_GZIP_BASE64) });
    })();
  }
  return initPromise;
}

const GRAMMAR_FIELD: Record<TreeSitterGrammar, keyof GrammarModule> = {
  c: "C_WASM_GZIP_BASE64",
  cpp: "CPP_WASM_GZIP_BASE64",
};

/** Load (and cache) a grammar. Safe to call repeatedly. */
export async function loadGrammar(
  grammar: TreeSitterGrammar,
): Promise<Parser.Language> {
  const cached = loaded.get(grammar);
  if (cached) return cached;
  await ensureInit();
  const module = await loadGrammarModule();
  const base64 = module[GRAMMAR_FIELD[grammar]];
  const language = await Parser.Language.load(await inflate(base64));
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
    (["c", "cpp"] as TreeSitterGrammar[]).map((grammar) => loadGrammar(grammar)),
  );
}
