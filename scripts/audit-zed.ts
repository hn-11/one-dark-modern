#!/usr/bin/env node
// Zed fidelity audit: does our "Zed One Dark *" translation render the way
// the real Zed would with semantic_tokens: "combined"?
//
// Zed side (ground truth): parse the fixtures with tree-sitter using ZED'S
// OWN highlight queries (audit/zed-queries/*.scm, auto-vendored from
// zed-industries/zed), resolve each capture against the Zed theme's syntax
// slots (longest-dotted-prefix, like Zed does) -> expected color per token.
//
// VS Code side: tokenize the same fixtures with the real TM grammars themed
// by our generated Zed variant, overlay LSP semantic tokens resolved against
// its semanticTokenColors -> effective color per token.
//
// A mismatch means our translation diverges from Zed's rendering. Known,
// accepted divergences live in audit/zed-allow.json with reasons.
//
// Usage: npm run audit:zed   (requires gopls on PATH)
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type * as tmTypes from "vscode-textmate";
import { readJson, root, type Theme } from "./lib.ts";
import { SemanticSession, type SemToken } from "./lsp.ts";

const require = createRequire(import.meta.url);
const tm: typeof tmTypes = require("vscode-textmate");
const oniguruma = require("vscode-oniguruma");
const TreeSitter = require("web-tree-sitter");

// ---- Zed ground truth ----
interface ZedFile {
  themes: Array<{ name: string; style: Record<string, unknown> }>;
}
const zedStyle = readJson<ZedFile>("upstream/zed-one.json").themes.find((t) =>
  /dark/i.test(t.name)
)!.style as Record<string, unknown>;
const zedSyntax = zedStyle.syntax as Record<string, { color: string }>;
const trim = (v: string): string => (v.toLowerCase().endsWith("ff") ? v.slice(0, 7) : v).toLowerCase();
const zedDefaultFg = trim((zedStyle["editor.foreground"] as string) ?? "#acb2beff");

interface ZedSemRule {
  token_type?: string;
  token_modifiers?: string[];
  style?: string[];
  foreground_color?: string;
}
// ground truth = Zed combined + our documented gap-fills (zed-semantic-extra)
const extra = readJson<Array<ZedSemRule & { languages?: string[] }>>(
  "overrides/zed-semantic-extra.json"
);
const extraFor = (vscodeLang: string): ZedSemRule[] =>
  extra.filter((r) => (r.languages ?? []).includes(vscodeLang));
const zedRules: Record<string, ZedSemRule[]> = {
  go: [
    ...readJson<ZedSemRule[]>("upstream/zed-semantic-go.json"),
    ...extraFor("go"),
    ...readJson<ZedSemRule[]>("upstream/zed-semantic-default.json"),
  ],
  ts: [
    ...extraFor("typescript"),
    ...readJson<ZedSemRule[]>("upstream/zed-semantic-default.json"),
  ],
};
// Zed combined mode: first matching rule whose style resolves wins
const zedSemanticColor = (lang: string, type: string, modifiers: string[]): string | null => {
  for (const rule of zedRules[lang] ?? []) {
    if (rule.token_type && rule.token_type !== type) continue;
    if (!(rule.token_modifiers ?? []).every((m) => modifiers.includes(m))) continue;
    if (rule.foreground_color) return rule.foreground_color.toLowerCase();
    for (const slot of rule.style ?? []) if (zedSyntax[slot]) return trim(zedSyntax[slot].color);
    // style unresolved: rule inapplicable, keep searching (Zed fallthrough)
  }
  return null;
};

// Zed resolves a capture name against syntax slots by trimming trailing
// dotted segments until a slot matches
const slotColor = (capture: string): { slot: string | null; color: string } => {
  const parts = capture.split(".");
  for (let n = parts.length; n > 0; n--) {
    const name = parts.slice(0, n).join(".");
    if (zedSyntax[name]) return { slot: name, color: trim(zedSyntax[name].color) };
  }
  return { slot: null, color: zedDefaultFg };
};

// ---- our generated Zed variant (VS Code side) ----
const theme = readJson<Theme>("themes/zed-one-dark-modern-color-theme.json");
const editorFg = (theme.colors["editor.foreground"] ?? "#acb2be").toLowerCase();
const semanticEntries = Object.entries(theme.semanticTokenColors ?? {});
const semColor = (type: string, modifiers: string[], lang: string): string | null => {
  let best: string | null = null;
  let bestScore = -1;
  for (const [sel, val] of semanticEntries) {
    const [selPart, selLang] = sel.split(":");
    const [selType, ...selMods] = selPart.split(".");
    if (selType !== type) continue;
    if (selLang && selLang !== lang) continue;
    if (!selMods.every((m) => modifiers.includes(m))) continue;
    const score = (selLang ? 100 : 0) + selMods.length * 10;
    if (score > bestScore) {
      const fg = typeof val === "string" ? val : (val as { foreground?: string }).foreground;
      if (fg) {
        best = fg.toLowerCase();
        bestScore = score;
      }
    }
  }
  return best;
};

// TM machinery themed with the Zed variant
const GRAMMARS: Record<string, { scope: string; file: string }> = {
  go: { scope: "source.go", file: "go.tmLanguage.json" },
  ts: { scope: "source.ts", file: "TypeScript.tmLanguage.json" },
};
const onigWasm = readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm"));
const onigLib = oniguruma.loadWASM(onigWasm.buffer as ArrayBuffer).then(() => ({
  createOnigScanner: (s: string[]) => new oniguruma.OnigScanner(s),
  createOnigString: (s: string) => new oniguruma.OnigString(s),
}));
const registry = new tm.Registry({
  onigLib,
  loadGrammar: async (scopeName: string) => {
    const g = Object.values(GRAMMARS).find((g) => g.scope === scopeName);
    if (!g) return null;
    const p = join(root, "audit/grammars", g.file);
    return tm.parseRawGrammar(readFileSync(p, "utf8"), p);
  },
});
registry.setTheme({
  settings: [
    { settings: { foreground: editorFg, background: theme.colors["editor.background"] ?? "#1f1f1f" } },
    ...theme.tokenColors.map((r) => ({ scope: r.scope as string | string[], settings: r.settings })),
  ],
});

async function tmColors(lang: string, text: string): Promise<Array<Array<{ s: number; e: number; c: number }>>> {
  const grammar = await registry.loadGrammar(GRAMMARS[lang].scope);
  if (!grammar) throw new Error(`grammar missing: ${lang}`);
  const lines = text.split("\n");
  const out: Array<Array<{ s: number; e: number; c: number }>> = [];
  let stack: tmTypes.StateStack | null = null;
  for (const line of lines) {
    const r = grammar.tokenizeLine2(line, stack);
    const toks: Array<{ s: number; e: number; c: number }> = [];
    const d = r.tokens;
    for (let i = 0; i < d.length; i += 2) {
      toks.push({
        s: d[i],
        e: i + 2 < d.length ? d[i + 2] : line.length,
        c: (d[i + 1] & 0b00000000111111111000000000000000) >>> 15,
      });
    }
    out.push(toks);
    stack = r.ruleStack;
  }
  return out;
}

// ---- allowlist ----
interface AllowEntry {
  lang: string;
  capture?: string; // zed capture name (or its resolved slot)
  text?: string; // exact token text
  zed?: string;
  vscode?: string;
  reason: string;
}
const allow = readJson<AllowEntry[]>("audit/zed-allow.json");

// ---- run ----
await (TreeSitter.Parser ?? TreeSitter).init?.();
const Parser = TreeSitter.Parser ?? TreeSitter;
const Language = TreeSitter.Language ?? Parser.Language;

interface Cap {
  name: string;
  row: number;
  col: number;
  endCol: number;
  endRow: number;
  text: string;
}

async function zedCaptures(lang: "go" | "ts", text: string): Promise<Cap[]> {
  const wasmPath =
    lang === "go"
      ? require.resolve("tree-sitter-go/tree-sitter-go.wasm")
      : require.resolve("tree-sitter-typescript/tree-sitter-typescript.wasm");
  const language = await Language.load(wasmPath);
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(text);
  const scm = readFileSync(
    join(root, "audit/zed-queries", lang === "go" ? "go-highlights.scm" : "typescript-highlights.scm"),
    "utf8"
  );
  const QueryCtor = TreeSitter.Query ?? language.query?.bind(language);
  const query = TreeSitter.Query ? new TreeSitter.Query(language, scm) : language.query(scm);
  const caps: Cap[] = [];
  for (const c of query.captures(tree.rootNode)) {
    const n = c.node;
    caps.push({
      name: c.name,
      row: n.startPosition.row,
      col: n.startPosition.column,
      endRow: n.endPosition.row,
      endCol: n.endPosition.column,
      text: text.slice(n.startIndex, Math.min(n.endIndex, n.startIndex + 30)),
    });
  }
  return caps;
}

const colorMapAll = () => registry.getColorMap().map((c) => (c ?? "").toLowerCase());

interface Mismatch {
  lang: string;
  file: string;
  line: number;
  text: string;
  capture: string;
  zed: string;
  vscode: string;
}
const mismatches: Mismatch[] = [];
let compared = 0;
let allowedCount = 0;

async function auditFile(
  lang: "go" | "ts",
  file: string,
  languageId: string,
  session: SemanticSession
): Promise<void> {
  const text = readFileSync(file, "utf8");
  const caps = await zedCaptures(lang, text);
  const tmLines = await tmColors(lang, text);
  const cmap = colorMapAll();
  const sem = await session.tokens(file, languageId, text);
  const semByLine = new Map<number, SemToken[]>();
  for (const t of sem) {
    const arr = semByLine.get(t.line) ?? [];
    arr.push(t);
    semByLine.set(t.line, arr);
  }
  const vsColorAt = (row: number, col: number): string => {
    for (const t of semByLine.get(row) ?? []) {
      if (t.start <= col && col < t.start + t.len) {
        const c = semColor(t.type, t.modifiers, languageId);
        if (c) return c;
        break; // semantic token present but unmapped -> TM shows through
      }
    }
    const tok = (tmLines[row] ?? []).find((k) => k.s <= col && col < k.e);
    return tok ? cmap[tok.c] || editorFg : editorFg;
  };
  const zedSemAt = (row: number, col: number): string | null => {
    for (const t of semByLine.get(row) ?? []) {
      if (t.start <= col && col < t.start + t.len)
        return zedSemanticColor(lang, t.type, t.modifiers);
    }
    return null;
  };

  // keep the LAST capture per exact range (tree-sitter highlighting
  // convention: later query patterns take precedence), and skip container
  // captures that strictly contain another capture - their inner tokens are
  // compared individually
  const byRange = new Map<string, Cap>();
  for (const cap of caps) byRange.set(`${cap.row}:${cap.col}:${cap.endRow}:${cap.endCol}`, cap);
  const deduped = [...byRange.values()];
  const contains = (a: Cap, b: Cap): boolean =>
    (a.row < b.row || (a.row === b.row && a.col <= b.col)) &&
    (a.endRow > b.endRow || (a.endRow === b.endRow && a.endCol >= b.endCol)) &&
    !(a.row === b.row && a.col === b.col && a.endRow === b.endRow && a.endCol === b.endCol);
  const containers = new Set<Cap>();
  for (const a of deduped)
    if (deduped.some((b) => b !== a && contains(a, b))) containers.add(a);

  for (const cap of deduped) {
    if (containers.has(cap)) continue;
    if (cap.endRow !== cap.row) continue; // multi-line captures (strings/comments) - sample not needed
    const { slot } = slotColor(cap.name);
    const zedColor = zedSemAt(cap.row, cap.col) ?? slotColor(cap.name).color;
    const vs = vsColorAt(cap.row, cap.col);
    compared++;
    if (vs === zedColor) continue;
    const isAllowed = allow.some(
      (a) =>
        a.lang === lang &&
        (!a.capture || a.capture === cap.name || a.capture === slot) &&
        (!a.text || a.text === cap.text.trim()) &&
        (!a.zed || a.zed.toLowerCase() === zedColor) &&
        (!a.vscode || a.vscode.toLowerCase() === vs)
    );
    if (isAllowed) {
      allowedCount++;
      continue;
    }
    mismatches.push({
      lang,
      file: file.replace(root + "/", ""),
      line: cap.row + 1,
      text: cap.text,
      capture: cap.name,
      zed: zedColor,
      vscode: vs,
    });
  }
}

const goRoot = join(root, "audit/fixtures/go");
for (const sub of readdirSync(goRoot)) {
  const dir = join(goRoot, sub);
  if (!statSync(dir).isDirectory()) continue;
  const session = new SemanticSession("gopls", [], dir, { semanticTokens: true }, { semanticTokens: true });
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".go"))) {
    await auditFile("go", join(dir, f), "go", session);
  }
  session.kill();
}
const tsDir = join(root, "audit/fixtures/ts");
const tsSession = new SemanticSession(
  join(root, "node_modules/.bin/typescript-language-server"),
  ["--stdio"],
  tsDir,
  {},
  {}
);
for (const f of readdirSync(tsDir).filter((f) => f.endsWith(".ts"))) {
  await auditFile("ts", join(tsDir, f), "typescript", tsSession);
}
tsSession.kill();

// group mismatches by (capture, zed, vscode) to keep the report readable
const grouped = new Map<string, { n: number; sample: Mismatch }>();
for (const m of mismatches) {
  const k = `${m.lang}|${m.capture}|${m.zed}|${m.vscode}`;
  const g = grouped.get(k);
  if (g) g.n++;
  else grouped.set(k, { n: 1, sample: m });
}
for (const { n, sample: m } of [...grouped.values()].sort((a, b) => b.n - a.n)) {
  console.log(
    `MISMATCH [${m.lang}] @${m.capture} zed ${m.zed} vs vscode ${m.vscode} x${n}  e.g. ${m.file}:${m.line} "${m.text}"`
  );
}
console.log(
  `\nzed fidelity: ${compared} captures compared, ${allowedCount} allowed, ${grouped.size} mismatch group(s) (${mismatches.length} tokens)`
);
process.exit(mismatches.length > 0 ? 1 : 0);
