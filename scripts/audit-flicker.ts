#!/usr/bin/env node
// Flicker audit: find tokens whose color CHANGES when semantic tokens land.
//
// Philosophy: "lexically unambiguous parts belong to TextMate; semantic may
// only fill in what TM could not decide." A violation is therefore:
//   TM gave a token a deliberate color (not the plain foreground) AND the
//   semantic layer resolves a DIFFERENT color for the same token.
// Semantic coloring of plain-foreground tokens is a legitimate correction
// and is reported only as a count.
//
// Coverage: Go (gopls) and TypeScript (typescript-language-server).
// Python/Shell have no open-source semantic token servers (Pylance is
// closed; bash-ls emits none), so they are TM-only here.
//
// Usage: npm run audit   (requires gopls on PATH)
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import type * as tmTypes from "vscode-textmate";

const require = createRequire(import.meta.url);
// both packages are CJS; require() them for reliable interop
const tm: typeof tmTypes = require("vscode-textmate");
const oniguruma = require("vscode-oniguruma");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

interface TokenRule {
  scope: string | string[];
  settings: { foreground?: string; fontStyle?: string };
}
interface Theme {
  colors: Record<string, string>;
  tokenColors: TokenRule[];
  semanticTokenColors: Record<string, string | { foreground?: string }>;
}
const theme: Theme = JSON.parse(
  readFileSync(join(root, "themes/one-dark-modern-color-theme.json"), "utf8")
);
const editorFg = (theme.colors["editor.foreground"] ?? "#abb2bf").toLowerCase();

interface AllowEntry {
  lang: string;
  type: string;
  modifiers?: string[];
  reason: string;
}
const allow: AllowEntry[] = JSON.parse(readFileSync(join(root, "audit/allow.json"), "utf8"));

// ---------- TextMate side ----------
const GRAMMARS: Record<string, { scope: string; file: string }> = {
  go: { scope: "source.go", file: "go.tmLanguage.json" },
  ts: { scope: "source.ts", file: "TypeScript.tmLanguage.json" },
  py: { scope: "source.python", file: "MagicPython.tmLanguage.json" },
  sh: { scope: "source.shell", file: "shell-unix-bash.tmLanguage.json" },
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

// per line: array of {start, end, colorIndex}
async function tmColors(lang: string, text: string): Promise<Array<Array<{ s: number; e: number; c: number }>>> {
  const grammar = await registry.loadGrammar(GRAMMARS[lang].scope);
  if (!grammar) throw new Error(`grammar not found for ${lang}`);
  const lines = text.split("\n");
  const out: Array<Array<{ s: number; e: number; c: number }>> = [];
  let stack: tmTypes.StateStack | null = null;
  for (const line of lines) {
    const r = grammar.tokenizeLine2(line, stack);
    const toks: Array<{ s: number; e: number; c: number }> = [];
    const d = r.tokens; // pairs of (startIndex, metadata)
    for (let i = 0; i < d.length; i += 2) {
      const start = d[i];
      const end = i + 2 < d.length ? d[i + 2] : line.length;
      const color = (d[i + 1] & 0b00000000111111111000000000000000) >>> 15;
      toks.push({ s: start, e: end, c: color });
    }
    out.push(toks);
    stack = r.ruleStack;
  }
  return out;
}

// ---------- semantic resolution (mirrors VS Code precedence) ----------
function semColor(type: string, modifiers: string[], lang: string): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const [sel, val] of Object.entries(theme.semanticTokenColors)) {
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

// ---------- minimal LSP client ----------
class Lsp {
  private proc: ChildProcess;
  private buf = Buffer.alloc(0);
  private id = 0;
  private pending = new Map<number, (v: unknown) => void>();
  private configResponse: unknown;
  constructor(cmd: string, args: string[], cwd: string, configResponse: unknown) {
    this.configResponse = configResponse;
    this.proc = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "ignore"] });
    this.proc.stdout!.on("data", (chunk: Buffer) => this.onData(chunk));
  }
  private onData(chunk: Buffer): void {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const headerEnd = this.buf.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const m = /Content-Length: (\d+)/.exec(this.buf.slice(0, headerEnd).toString());
      if (!m) return;
      const len = parseInt(m[1], 10);
      if (this.buf.length < headerEnd + 4 + len) return;
      const msg = JSON.parse(this.buf.slice(headerEnd + 4, headerEnd + 4 + len).toString());
      this.buf = this.buf.slice(headerEnd + 4 + len);
      this.dispatch(msg);
    }
  }
  private dispatch(msg: { id?: number; method?: string; params?: unknown; result?: unknown }): void {
    if (msg.method && msg.id !== undefined) {
      // server -> client request: answer enough to keep servers happy
      let result: unknown = null;
      if (msg.method === "workspace/configuration") {
        const items = (msg.params as { items: unknown[] }).items;
        result = items.map(() => this.configResponse);
      }
      this.send({ jsonrpc: "2.0", id: msg.id, result });
    } else if (msg.id !== undefined && this.pending.has(msg.id)) {
      this.pending.get(msg.id)!(msg.result);
      this.pending.delete(msg.id);
    }
  }
  private send(obj: unknown): void {
    const s = JSON.stringify(obj);
    this.proc.stdin!.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`);
  }
  request<T>(method: string, params: unknown): Promise<T> {
    const id = ++this.id;
    this.send({ jsonrpc: "2.0", id, method, params });
    return new Promise((res) => this.pending.set(id, res as (v: unknown) => void));
  }
  notify(method: string, params: unknown): void {
    this.send({ jsonrpc: "2.0", method, params });
  }
  kill(): void {
    this.proc.kill();
  }
}

interface SemToken {
  line: number;
  start: number;
  len: number;
  type: string;
  modifiers: string[];
}

async function semanticTokens(
  cmd: string,
  args: string[],
  cwd: string,
  fileUri: string,
  languageId: string,
  text: string,
  initOptions: unknown,
  configResponse: unknown
): Promise<SemToken[]> {
  const lsp = new Lsp(cmd, args, cwd, configResponse);
  const init = await lsp.request<{
    capabilities: { semanticTokensProvider?: { legend: { tokenTypes: string[]; tokenModifiers: string[] } } };
  }>("initialize", {
    processId: process.pid,
    rootUri: pathToFileURL(cwd).toString(),
    workspaceFolders: [{ uri: pathToFileURL(cwd).toString(), name: "fixture" }],
    initializationOptions: initOptions,
    capabilities: {
      workspace: { configuration: true },
      textDocument: {
        semanticTokens: {
          requests: { full: true },
          tokenTypes: [],
          tokenModifiers: [],
          formats: ["relative"],
        },
      },
    },
  });
  const legend = init.capabilities.semanticTokensProvider?.legend;
  lsp.notify("initialized", {});
  lsp.notify("textDocument/didOpen", {
    textDocument: { uri: fileUri, languageId, version: 1, text },
  });
  // poll until the server has analyzed the file
  let data: number[] | null = null;
  for (let i = 0; i < 30; i++) {
    const r = await lsp.request<{ data: number[] } | null>("textDocument/semanticTokens/full", {
      textDocument: { uri: fileUri },
    });
    if (r && r.data && r.data.length > 0) {
      data = r.data;
      break;
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  lsp.kill();
  if (!data || !legend) return [];
  const toks: SemToken[] = [];
  let line = 0;
  let start = 0;
  for (let i = 0; i < data.length; i += 5) {
    line += data[i];
    start = data[i] === 0 ? start + data[i + 1] : data[i + 1];
    const mods: string[] = [];
    for (let b = 0; b < legend.tokenModifiers.length; b++)
      if (data[i + 4] & (1 << b)) mods.push(legend.tokenModifiers[b]);
    toks.push({ line, start, len: data[i + 2], type: legend.tokenTypes[data[i + 3]], modifiers: mods });
  }
  return toks;
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

async function auditLang(
  lang: "go" | "ts",
  file: string,
  languageId: string,
  server: [string, string[]],
  initOptions: unknown,
  configResponse: unknown
): Promise<{ findings: Finding[]; corrections: number; total: number }> {
  const cwd = join(root, "audit/fixtures", lang);
  const path = join(cwd, file);
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const tmByLine = await tmColors(lang, text);
  const colorMap = registry.getColorMap().map((c) => (c ?? "").toLowerCase());
  const sem = await semanticTokens(
    server[0],
    server[1],
    cwd,
    pathToFileURL(path).toString(),
    languageId,
    text,
    initOptions,
    configResponse
  );
  const findings: Finding[] = [];
  let corrections = 0;
  for (const t of sem) {
    const semFg = semColor(t.type, t.modifiers, languageId);
    if (!semFg) continue; // unmapped -> falls back to TM: never a flicker
    const tmTok = (tmByLine[t.line] ?? []).find((k) => k.s <= t.start && t.start < k.e);
    if (!tmTok) continue;
    const tmFg = colorMap[tmTok.c] ?? editorFg;
    if (tmFg === semFg) continue;
    if (tmFg === editorFg) {
      corrections++; // TM had no opinion: legitimate correction
      continue;
    }
    const word = lines[t.line].slice(t.start, t.start + t.len);
    const allowed = allow.some(
      (a) =>
        a.lang === languageId &&
        a.type === t.type &&
        (a.modifiers ?? []).every((m) => t.modifiers.includes(m))
    );
    if (allowed) continue;
    findings.push({
      lang: languageId,
      file: `audit/fixtures/${lang}/${file}`,
      line: t.line + 1,
      text: word,
      type: t.type,
      modifiers: t.modifiers,
      tmColor: tmFg,
      semanticColor: semFg,
    });
  }
  return { findings, corrections, total: sem.length };
}

// TM-only sanity pass: report fixture coverage for languages without a server
async function tmOnly(lang: "py" | "sh", file: string): Promise<number> {
  const text = readFileSync(join(root, "audit/fixtures", lang, file), "utf8");
  const toks = await tmColors(lang, text);
  return toks.flat().length;
}

const results = [
  await auditLang("go", "main.go", "go", ["gopls", []], { semanticTokens: true }, { semanticTokens: true }),
  await auditLang(
    "ts",
    "sample.ts",
    "typescript",
    [join(root, "node_modules/.bin/typescript-language-server"), ["--stdio"]],
    {},
    {}
  ),
];
const pyTokens = await tmOnly("py", "sample.py");
const shTokens = await tmOnly("sh", "sample.sh");

let violations = 0;
for (const r of results) {
  violations += r.findings.length;
  for (const f of r.findings) {
    console.log(
      `VIOLATION [${f.lang}] ${f.file}:${f.line} "${f.text}" ` +
        `${f.type}${f.modifiers.length ? "." + f.modifiers.join(".") : ""} ` +
        `TM ${f.tmColor} -> semantic ${f.semanticColor}`
    );
  }
}
console.log(
  `\ngo: ${results[0].total} semantic tokens, ${results[0].corrections} corrections, ${results[0].findings.length} violations`
);
console.log(
  `ts: ${results[1].total} semantic tokens, ${results[1].corrections} corrections, ${results[1].findings.length} violations`
);
console.log(`py: TM-only (${pyTokens} tokens; Pylance semantic tokens are closed-source)`);
console.log(`sh: TM-only (${shTokens} tokens; no semantic token server exists)`);
process.exit(violations > 0 ? 1 : 0);
