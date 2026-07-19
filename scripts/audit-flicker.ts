#!/usr/bin/env node
// Flicker audit: find tokens whose color CHANGES when semantic tokens land.
//
// Philosophy: "lexically unambiguous parts belong to TextMate; semantic may
// only fill in what TM could not decide." A violation is therefore:
//   TM gave a token a deliberate color (not the plain foreground) AND the
//   semantic layer resolves a DIFFERENT color for the same token.
// Intentional corrections are documented in audit/allow.json.
//
// Also reports coverage:
//   - semantic: observed type.modifiers combos per language, snapshotted in
//     audit/coverage-semantic.json (run with --update to accept new combos;
//     unseen combos fail the audit so server drift is surfaced)
//   - TextMate: which theme tokenColors rules matched at least one fixture
//     token (unexercised rules -> audit/coverage-tm.json, informational)
//
// Coverage: Go (gopls) and TypeScript (typescript-language-server).
// Python/Shell have no open-source semantic token servers (Pylance is
// closed; bash-ls emits none), so they are TM-only here.
//
// Usage: npm run audit [-- --update]   (requires gopls on PATH)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type * as tmTypes from "vscode-textmate";
import { loadBuiltTheme, root } from "./lib.ts";
import { SemanticSession, type SemToken } from "./lsp.ts";

const require = createRequire(import.meta.url);
// both packages are CJS; require() them for reliable interop
const tm: typeof tmTypes = require("vscode-textmate");
const oniguruma = require("vscode-oniguruma");
const UPDATE = process.argv.includes("--update");

const theme = loadBuiltTheme();
const semanticEntries = Object.entries(theme.semanticTokenColors ?? {});
const editorFg = (theme.colors["editor.foreground"] ?? "#abb2bf").toLowerCase();

interface AllowEntry {
  lang: string | string[];
  type: string;
  modifiers?: string[];
  tmColor?: string; // if set, only allowed when TM resolved exactly this color
  reason: string;
}
const langMatches = (a: AllowEntry, lang: string): boolean =>
  Array.isArray(a.lang) ? a.lang.includes(lang) : a.lang === lang;
const allow: AllowEntry[] = JSON.parse(readFileSync(join(root, "audit/allow.json"), "utf8"));

// ---------- TextMate side ----------
const GRAMMARS: Record<string, { scope: string; file: string }> = {
  go: { scope: "source.go", file: "go.tmLanguage.json" },
  ts: { scope: "source.ts", file: "TypeScript.tmLanguage.json" },
  tsx: { scope: "source.tsx", file: "TypeScriptReact.tmLanguage.json" },
  js: { scope: "source.js", file: "JavaScript.tmLanguage.json" },
  jsx: { scope: "source.js.jsx", file: "JavaScriptReact.tmLanguage.json" },
  py: { scope: "source.python", file: "MagicPython.tmLanguage.json" },
  sh: { scope: "source.shell", file: "shell-unix-bash.tmLanguage.json" },
};
// file extension -> (grammar key, LSP languageId)
const EXT_LANG: Record<string, { grammar: string; languageId: string }> = {
  ".ts": { grammar: "ts", languageId: "typescript" },
  ".tsx": { grammar: "tsx", languageId: "typescriptreact" },
  ".js": { grammar: "js", languageId: "javascript" },
  ".jsx": { grammar: "jsx", languageId: "javascriptreact" },
};

const wasm = readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm"));
const onigLib = oniguruma.loadWASM(wasm.buffer as ArrayBuffer).then(() => ({
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

interface TmLine {
  colors: Array<{ s: number; e: number; c: number }>;
  scopes: Array<{ s: number; e: number; stack: string[] }>;
}

async function tmTokenize(lang: string, text: string): Promise<TmLine[]> {
  const grammar = await registry.loadGrammar(GRAMMARS[lang].scope);
  if (!grammar) throw new Error(`grammar not found for ${lang}`);
  const lines = text.split("\n");
  const out: TmLine[] = [];
  let stack2: tmTypes.StateStack | null = null;
  let stack1: tmTypes.StateStack | null = null;
  for (const line of lines) {
    const r2 = grammar.tokenizeLine2(line, stack2);
    const colors: TmLine["colors"] = [];
    const d = r2.tokens;
    for (let i = 0; i < d.length; i += 2) {
      colors.push({
        s: d[i],
        e: i + 2 < d.length ? d[i + 2] : line.length,
        c: (d[i + 1] & 0b00000000111111111000000000000000) >>> 15,
      });
    }
    const r1 = grammar.tokenizeLine(line, stack1);
    const scopes: TmLine["scopes"] = r1.tokens.map((t) => ({
      s: t.startIndex,
      e: t.endIndex,
      stack: t.scopes,
    }));
    out.push({ colors, scopes });
    stack2 = r2.ruleStack;
    stack1 = r1.ruleStack;
  }
  return out;
}

// ---------- TM rule coverage ----------
// selector part matches a scope if equal or a dot-prefix of it
const partMatches = (part: string, scope: string): boolean =>
  scope === part || scope.startsWith(part + ".");
// descendant selector: every part must match successive scopes in the stack
function selectorMatches(selector: string, stack: string[]): boolean {
  const parts = selector.trim().split(/\s+/).filter((p) => p !== ">");
  let idx = 0;
  for (const part of parts) {
    let found = -1;
    for (let j = idx; j < stack.length; j++) {
      if (partMatches(part, stack[j])) {
        found = j;
        break;
      }
    }
    if (found < 0) return false;
    idx = found + 1;
  }
  return true;
}
const ruleSelectors: string[][] = theme.tokenColors.map((r) => {
  const raw = Array.isArray(r.scope) ? r.scope : [r.scope];
  return raw.flatMap((s) => s.split(","));
});
const ruleFired = new Array<boolean>(theme.tokenColors.length).fill(false);
function recordRuleCoverage(lines: TmLine[]): void {
  for (const line of lines) {
    for (const tok of line.scopes) {
      for (let r = 0; r < ruleSelectors.length; r++) {
        if (ruleFired[r]) continue;
        if (ruleSelectors[r].some((sel) => selectorMatches(sel, tok.stack))) ruleFired[r] = true;
      }
    }
  }
}

// ---------- semantic resolution (mirrors VS Code precedence) ----------
function semColor(type: string, modifiers: string[], lang: string): string | null {
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
      const fg = typeof val === "string" ? val : val.foreground;
      if (fg) {
        best = fg;
        bestScore = score;
      }
    }
  }
  return best ? best.toLowerCase() : null;
}

// ---------- comparison ----------
interface Finding {
  lang: string;
  file: string;
  line: number;
  text: string;
  type: string;
  modifiers: string[];
  tmColor: string;
  semanticColor: string;
}

const observedCombos = new Set<string>();

function compare(
  languageId: string,
  fileLabel: string,
  text: string,
  tmLines: TmLine[],
  sem: SemToken[]
): { findings: Finding[]; corrections: number } {
  const lines = text.split("\n");
  const colorMap = registry.getColorMap().map((c) => (c ?? "").toLowerCase());
  const findings: Finding[] = [];
  let corrections = 0;
  for (const t of sem) {
    observedCombos.add(`${languageId}|${[t.type, ...t.modifiers.slice().sort()].join(".")}`);
    const semFg = semColor(t.type, t.modifiers, languageId);
    if (!semFg) continue; // unmapped -> falls back to TM: never a flicker
    const tmTok = (tmLines[t.line]?.colors ?? []).find((k) => k.s <= t.start && t.start < k.e);
    if (!tmTok) continue;
    const tmFg = colorMap[tmTok.c] || editorFg;
    if (tmFg === semFg) continue;
    if (tmFg === editorFg) {
      corrections++;
      continue;
    }
    if (
      allow.some(
        (a) =>
          langMatches(a, languageId) &&
          a.type === t.type &&
          (a.modifiers ?? []).every((m) => t.modifiers.includes(m)) &&
          (!a.tmColor || a.tmColor === tmFg)
      )
    )
      continue;
    findings.push({
      lang: languageId,
      file: fileLabel,
      line: t.line + 1,
      text: lines[t.line].slice(t.start, t.start + t.len),
      type: t.type,
      modifiers: t.modifiers,
      tmColor: tmFg,
      semanticColor: semFg,
    });
  }
  return { findings, corrections };
}

const listFiles = (dir: string, ext: string): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f));

// ---------- run ----------
const findings: Finding[] = [];
let corrections = 0;
let semTotal = 0;

// Go: one gopls session per module dir
const goRoot = join(root, "audit/fixtures/go");
for (const sub of readdirSync(goRoot)) {
  const dir = join(goRoot, sub);
  if (!statSync(dir).isDirectory()) continue;
  const session = new SemanticSession("gopls", [], dir, { semanticTokens: true }, { semanticTokens: true });
  for (const file of listFiles(dir, ".go")) {
    const text = readFileSync(file, "utf8");
    const tmLines = await tmTokenize("go", text);
    recordRuleCoverage(tmLines);
    const sem = await session.tokens(file, "go", text);
    semTotal += sem.length;
    const r = compare("go", file.replace(root + "/", ""), text, tmLines, sem);
    findings.push(...r.findings);
    corrections += r.corrections;
  }
  session.kill();
}

// TS/TSX/JS/JSX: one server per fixture dir, languageId by extension
for (const sub of ["ts", "js"]) {
  const dir = join(root, "audit/fixtures", sub);
  const session = new SemanticSession(
    join(root, "node_modules/.bin/typescript-language-server"),
    ["--stdio"],
    dir,
    {},
    {}
  );
  const files = readdirSync(dir)
    .map((f) => join(dir, f))
    .filter((f) => EXT_LANG[f.slice(f.lastIndexOf("."))]);
  for (const file of files) {
    const { grammar, languageId } = EXT_LANG[file.slice(file.lastIndexOf("."))];
    const text = readFileSync(file, "utf8");
    const tmLines = await tmTokenize(grammar, text);
    recordRuleCoverage(tmLines);
    const sem = await session.tokens(file, languageId, text);
    semTotal += sem.length;
    const r = compare(languageId, file.replace(root + "/", ""), text, tmLines, sem);
    findings.push(...r.findings);
    corrections += r.corrections;
  }
  session.kill();
}

// Python / Shell: TM-only (rule coverage still counts)
let tmOnlyTokens = 0;
for (const [lang, ext] of [
  ["py", ".py"],
  ["sh", ".sh"],
] as const) {
  for (const file of listFiles(join(root, "audit/fixtures", lang), ext)) {
    const tmLines = await tmTokenize(lang, readFileSync(file, "utf8"));
    recordRuleCoverage(tmLines);
    tmOnlyTokens += tmLines.reduce((n, l) => n + l.scopes.length, 0);
  }
}

// ---------- report ----------
for (const f of findings) {
  console.log(
    `VIOLATION [${f.lang}] ${f.file}:${f.line} "${f.text}" ` +
      `${f.type}${f.modifiers.length ? "." + f.modifiers.join(".") : ""} ` +
      `TM ${f.tmColor} -> semantic ${f.semanticColor}`
  );
}

// semantic combo coverage vs snapshot
const comboPath = join(root, "audit/coverage-semantic.json");
const combos = [...observedCombos].sort();
let newCombos: string[] = [];
try {
  const known: string[] = JSON.parse(readFileSync(comboPath, "utf8"));
  newCombos = combos.filter((c) => !known.includes(c));
} catch {
  newCombos = combos;
}
if (UPDATE || newCombos.length === 0) {
  if (UPDATE) writeFileSync(comboPath, JSON.stringify(combos, null, 2) + "\n");
} else {
  console.log(`\nNEW semantic type/modifier combos (unaudited color paths — review, then run with --update):`);
  for (const c of newCombos) console.log(`  ${c}`);
}

// TM rule coverage
const unexercised = theme.tokenColors
  .map((r, i) => ({ i, scope: r.scope }))
  .filter(({ i }) => !ruleFired[i]);
writeFileSync(
  join(root, "audit/coverage-tm.json"),
  JSON.stringify(unexercised.map((u) => u.scope), null, 2) + "\n"
);

console.log(`\nsemantic tokens: ${semTotal} (corrections of plain tokens: ${corrections})`);
console.log(`semantic combos observed: ${combos.length} (${newCombos.length} new vs snapshot)`);
console.log(
  `TM rules exercised: ${ruleFired.filter(Boolean).length}/${theme.tokenColors.length} ` +
    `(unexercised list -> audit/coverage-tm.json)`
);
console.log(`py/sh TM-only tokens: ${tmOnlyTokens}`);
console.log(`violations: ${findings.length}`);
process.exit(findings.length > 0 || (newCombos.length > 0 && !UPDATE) ? 1 : 0);
