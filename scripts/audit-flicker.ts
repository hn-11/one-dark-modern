#!/usr/bin/env node
// Flicker audit: find tokens whose appearance CHANGES when semantic tokens land.
//
// Philosophy: "lexically unambiguous parts belong to TextMate; semantic may
// only fill in what TM could not decide." A violation is therefore:
//   TM gave a token a deliberate appearance (not the plain foreground, or an
//   explicit fontStyle) AND the semantic layer resolves a DIFFERENT
//   foreground / fontStyle for the same token.
// Intentional corrections are documented in audit/allow.json.
//
// The semantic side is resolved the way VS Code resolves it, which includes the
// part the audit used to skip: when no `semanticTokenColors` rule matches, VS
// Code falls back to the default *token classification scope map* and
// re-resolves the token against `tokenColors` (see SCOPE_DEFAULTS below). A
// token with no semantic rule is therefore NOT automatically flicker-free.
//
// Also reports coverage:
//   - semantic: observed type.modifiers combos per language, snapshotted in
//     audit/coverage-semantic.json (run with --update to accept the new set;
//     both new AND lost combos fail the audit so server drift is surfaced)
//   - TextMate: which theme tokenColors selectors matched at least one fixture
//     token; the unexercised list is snapshotted in audit/coverage-tm.json and
//     growth of that list fails the audit
//
// Coverage: Go (gopls) and TypeScript (typescript-language-server).
// Python/Shell have no open-source semantic token servers (Pylance is
// closed; bash-ls emits none), so they are TM-only here.
//
// Usage: npm run audit [-- --update]   (requires gopls on PATH)
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type * as tmTypes from "vscode-textmate";
import { loadBuiltTheme, readJson, root, type Theme, type TokenRule } from "./lib.ts";
import { SemanticSession, type SemToken } from "./lsp.ts";

const require = createRequire(import.meta.url);
// both packages are CJS; require() them for reliable interop
const tm: typeof tmTypes = require("vscode-textmate");
const oniguruma = require("vscode-oniguruma");
const UPDATE = process.argv.includes("--update");

const theme = loadBuiltTheme();
const semanticEntries = Object.entries(theme.semanticTokenColors ?? {});
const editorFg = (theme.colors["editor.foreground"] ?? "#abb2bf").toLowerCase();

// hard errors that are not per-token findings (stale allows, dead fixtures,
// coverage regressions, ...). Collected so one run reports everything.
const errors: string[] = [];
const fail = (msg: string): void => {
  errors.push(msg);
};

// ---------- item 20: the syntax layer is shared, so assert it ----------
// Both themes are built from the same syntax/ sources; only the workbench
// (colors) differs. The audit only ever inspects one of them, which is sound
// exactly as long as that stays true.
{
  const other = readJson<Theme>("themes/one-dark-modern-color-theme.json");
  const norm = (v: unknown): string => JSON.stringify(v);
  if (norm(other.tokenColors) !== norm(theme.tokenColors))
    fail(
      "THEME DIVERGENCE: tokenColors differ between one-dark-modern and one-dark-2026. " +
        "The syntax layer is supposed to be identical across workbench generations " +
        "(docs/PHILOSOPHY.md §1/§10); the audit only checks one theme, so this must not drift."
    );
  if (norm(other.semanticTokenColors ?? {}) !== norm(theme.semanticTokenColors ?? {}))
    fail(
      "THEME DIVERGENCE: semanticTokenColors differ between one-dark-modern and one-dark-2026. " +
        "See docs/PHILOSOPHY.md §1/§10 - the syntax layer is shared."
    );
}

// ---------- allow list (with hit counting, item 13) ----------
interface AllowEntry {
  lang: string | string[];
  type: string;
  modifiers?: string[];
  tmColor?: string; // if set, only allowed when TM resolved exactly this color
  /**
   * Which aspect(s) of the appearance this entry excuses. Defaults to
   * ["foreground"], so a colour ruling never silently excuses a fontStyle
   * flicker (or the other way round) — each needs its own reasoned entry.
   */
  aspects?: string[];
  reason: string;
}
const langMatches = (a: AllowEntry, lang: string): boolean =>
  Array.isArray(a.lang) ? a.lang.includes(lang) : a.lang === lang;
const allow: AllowEntry[] = JSON.parse(readFileSync(join(root, "audit/allow.json"), "utf8"));
const allowHits = new Array<number>(allow.length).fill(0);
const allowAspects = (a: AllowEntry): string[] => a.aspects ?? ["foreground"];
const describeAllow = (a: AllowEntry): string =>
  `${Array.isArray(a.lang) ? a.lang.join("/") : a.lang} ${a.type}` +
  (a.modifiers?.length ? "." + a.modifiers.join(".") : "") +
  (a.tmColor ? ` tmColor=${a.tmColor}` : "") +
  ` [${allowAspects(a).join(",")}]`;

// fixtures that legitimately produce zero semantic tokens (item 15). Empty is
// the healthy state: every entry here is a fixture the LSP cannot see.
const zeroSemanticAllow: Record<string, string> = readJson<Record<string, string>>(
  "audit/zero-semantic-allow.json"
);

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

// vscode-textmate metadata bit layout (see MetadataConsts): fontStyle is 4
// bits at offset 11, foreground index is 9 bits at offset 15.
const META_FG_MASK = 0b00000000111111111000000000000000;
const META_FG_OFFSET = 15;
const META_FS_MASK = 0b00000000000000000111100000000000;
const META_FS_OFFSET = 11;
const FS_ITALIC = 1;
const FS_BOLD = 2;
const FS_UNDERLINE = 4;
const FS_STRIKETHROUGH = 8;

interface TmLine {
  colors: Array<{ s: number; e: number; c: number; fs: number }>;
  scopes: Array<{ s: number; e: number; stack: string[] }>;
}

const splitLines = (text: string): string[] => text.split(/\r?\n/);

async function tmTokenize(lang: string, text: string): Promise<TmLine[]> {
  const grammar = await registry.loadGrammar(GRAMMARS[lang].scope);
  if (!grammar) throw new Error(`grammar not found for ${lang}`);
  const lines = splitLines(text);
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
        c: (d[i + 1] & META_FG_MASK) >>> META_FG_OFFSET,
        fs: (d[i + 1] & META_FS_MASK) >>> META_FS_OFFSET,
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
// coverage is tracked per individual selector (rules are merged per family
// since v0.1.1, so rule-level coverage would be trivially saturated)
const allSelectors: string[] = theme.tokenColors.flatMap((r) => {
  const raw = Array.isArray(r.scope) ? r.scope : [r.scope];
  return raw.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
});
const selectorFired = new Array<boolean>(allSelectors.length).fill(false);
function recordRuleCoverage(lines: TmLine[]): void {
  for (const line of lines) {
    for (const tok of line.scopes) {
      for (let i = 0; i < allSelectors.length; i++) {
        if (selectorFired[i]) continue;
        if (selectorMatches(allSelectors[i], tok.stack)) selectorFired[i] = true;
      }
    }
  }
}

// ---------- VS Code's default token-classification scope map (item 2) -------
// Reproduced from vscode's src/vs/platform/theme/common/tokenClassificationRegistry.ts
// (createDefaultTokenClassificationRegistry + the registerTokenStyleDefault
// block). When no `semanticTokenColors` rule matches a semantic token, VS Code
// resolves these "probe scopes" against the theme's tokenColors and uses the
// result - so an unmapped semantic token can still repaint what TM decided.
//
// Each probe is a scope PATH; VS Code tries them in order and takes the first
// one that resolves to anything. Every path here is single-element, which is
// what the resolver below assumes.
interface ScopeDefault {
  /** "type" or "type.modifier[.modifier]" - no language part in the defaults */
  selector: string;
  probes: string[][];
}
const SCOPE_DEFAULTS: ScopeDefault[] = [
  // --- token types ---
  { selector: "comment", probes: [["comment"]] },
  { selector: "string", probes: [["string"]] },
  { selector: "keyword", probes: [["keyword.control"]] },
  { selector: "number", probes: [["constant.numeric"]] },
  { selector: "regexp", probes: [["constant.regexp"]] },
  { selector: "operator", probes: [["keyword.operator"]] },
  { selector: "namespace", probes: [["entity.name.namespace"]] },
  { selector: "type", probes: [["entity.name.type"], ["support.type"]] },
  { selector: "struct", probes: [["storage.type.struct"], ["entity.name.type.struct"]] },
  { selector: "class", probes: [["entity.name.type.class"], ["support.class"]] },
  { selector: "interface", probes: [["entity.name.type.interface"]] },
  { selector: "enum", probes: [["entity.name.type.enum"]] },
  { selector: "typeParameter", probes: [["entity.name.type.parameter"]] },
  { selector: "function", probes: [["entity.name.function"], ["support.function"]] },
  { selector: "member", probes: [["entity.name.function.member"], ["support.function"]] },
  { selector: "method", probes: [["entity.name.function.member"], ["support.function"]] },
  { selector: "macro", probes: [["entity.name.function.preprocessor"]] },
  { selector: "variable", probes: [["variable.other.readwrite"], ["entity.name.variable"]] },
  { selector: "parameter", probes: [["variable.parameter"]] },
  { selector: "property", probes: [["variable.other.property"]] },
  { selector: "enumMember", probes: [["variable.other.enummember"]] },
  { selector: "event", probes: [["variable.other.event"]] },
  { selector: "decorator", probes: [["entity.name.decorator"], ["entity.name.function"]] },
  // --- type + modifier defaults ---
  { selector: "variable.readonly", probes: [["variable.other.constant"]] },
  { selector: "property.readonly", probes: [["variable.other.constant.property"]] },
  { selector: "type.defaultLibrary", probes: [["support.type"]] },
  { selector: "class.defaultLibrary", probes: [["support.class"]] },
  { selector: "interface.defaultLibrary", probes: [["support.class"]] },
  {
    selector: "variable.defaultLibrary",
    probes: [["support.variable"], ["support.other.variable"]],
  },
  { selector: "variable.defaultLibrary.readonly", probes: [["support.constant"]] },
  { selector: "property.defaultLibrary", probes: [["support.variable.property"]] },
  { selector: "property.defaultLibrary.readonly", probes: [["support.constant.property"]] },
  { selector: "function.defaultLibrary", probes: [["support.function"]] },
  { selector: "member.defaultLibrary", probes: [["support.function"]] },
];
// `member` is registered as a deprecated alias with superType `method`, so a
// theme rule for `method` also matches a `member` token (at a lower score).
const SUPER_TYPES: Record<string, string> = { member: "method" };
const typeHierarchy = (type: string): string[] => {
  const out = [type];
  for (let t = SUPER_TYPES[type]; t; t = SUPER_TYPES[t]) out.push(t);
  return out;
};

// ---------- style model ----------
interface Style {
  foreground?: string;
  italic?: boolean;
  bold?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}
const STYLE_FLAGS = ["italic", "bold", "underline", "strikethrough"] as const;
type StyleFlag = (typeof STYLE_FLAGS)[number];

// VS Code's TokenStyle.fromSettings: a fontStyle STRING defines every flag
// (absent word => false); an absent fontStyle leaves them all undefined.
const styleFromSettings = (s: TokenRule["settings"]): Style => {
  const out: Style = {};
  if (s.foreground) out.foreground = s.foreground.toLowerCase();
  if (s.fontStyle !== undefined) {
    out.italic = /\bitalic\b/.test(s.fontStyle);
    out.bold = /\bbold\b/.test(s.fontStyle);
    out.underline = /\bunderline\b/.test(s.fontStyle);
    out.strikethrough = /\bstrikethrough\b/.test(s.fontStyle);
  }
  return out;
};

// ---------- resolveScopes: probe scopes against tokenColors ----------
// Mirrors ColorThemeData.resolveScopes / nameMatcher. Because every probe is a
// single-element scope path, only single-part selectors can match, and the
// score reduces to the selector's length (longer = more specific, ties keep the
// earlier rule - VS Code compares with strict `>`).
const scopesAreMatching = (scope: string, selector: string): boolean =>
  scope === selector || (scope.startsWith(selector) && scope[selector.length] === ".");

interface FlatRule {
  selector: string;
  settings: TokenRule["settings"];
}
const flatRules: FlatRule[] = theme.tokenColors.flatMap((r) => {
  const raw = Array.isArray(r.scope) ? r.scope : [r.scope];
  return raw
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean)
    .map((selector) => ({ selector, settings: r.settings }));
});

function resolveScopes(probes: string[][]): Style | undefined {
  for (const path of probes) {
    // VS Code matches the whole path; ours are single-element by construction
    const scope = path[path.length - 1];
    let foreground: string | undefined;
    let fontStyle: string | undefined;
    let fgScore = -1;
    let fsScore = -1;
    for (const { selector, settings } of flatRules) {
      if (/\s/.test(selector)) continue; // descendant selector cannot match a 1-deep path
      if (!scopesAreMatching(scope, selector)) continue;
      const score = selector.length;
      if (settings.foreground !== undefined && score > fgScore) {
        foreground = settings.foreground;
        fgScore = score;
      }
      if (settings.fontStyle !== undefined && score > fsScore) {
        fontStyle = settings.fontStyle;
        fsScore = score;
      }
    }
    if (foreground !== undefined || fontStyle !== undefined)
      return styleFromSettings({ foreground, fontStyle });
  }
  return undefined;
}

// ---------- semantic resolution (mirrors VS Code precedence) ----------
// 1. the theme's own semanticTokenColors rules (highest scoring wins; ties go
//    to the first rule, as in VS Code)
// 2. for every property STILL undefined: the default scope map above, resolved
//    against tokenColors
const semStyleCache = new Map<string, Style>();
function semStyle(type: string, modifiers: string[], lang: string): Style {
  const key = `${lang}|${type}|${[...modifiers].sort().join(".")}`;
  const cached = semStyleCache.get(key);
  if (cached) return cached;

  const hierarchy = typeHierarchy(type);
  const style: Style = {};
  let best = -1;
  for (const [sel, val] of semanticEntries) {
    const [selPart, selLang] = sel.split(":");
    const [selType, ...selMods] = selPart.split(".");
    const hIdx = hierarchy.indexOf(selType);
    if (selType !== "*" && hIdx < 0) continue;
    if (selLang && selLang !== "*" && selLang !== lang) continue;
    if (!selMods.every((m) => modifiers.includes(m))) continue;
    const score =
      (selLang ? 1000 : 0) + selMods.length * 100 + (selType === "*" ? 0 : 100 - hIdx);
    if (score <= best) continue; // strict >: first rule wins a tie
    best = score;
    if (typeof val === "string") {
      style.foreground = val.toLowerCase();
    } else {
      if (val.foreground) style.foreground = val.foreground.toLowerCase();
      for (const f of STYLE_FLAGS) {
        const v = (val as Record<string, unknown>)[f];
        if (typeof v === "boolean") style[f] = v;
      }
    }
  }

  // default scope map fills only what the theme left open (ascending score, so
  // the most specific default wins)
  const defaults = SCOPE_DEFAULTS.map((d) => {
    const [dType, ...dMods] = d.selector.split(".");
    const hIdx = hierarchy.indexOf(dType);
    if (hIdx < 0) return null;
    if (!dMods.every((m) => modifiers.includes(m))) return null;
    return { d, score: dMods.length * 100 + (100 - hIdx) };
  })
    .filter((x): x is { d: ScopeDefault; score: number } => x !== null)
    .sort((a, b) => a.score - b.score);
  const fromTheme = { ...style };
  for (const { d } of defaults) {
    const probed = resolveScopes(d.probes);
    if (!probed) continue;
    if (fromTheme.foreground === undefined && probed.foreground !== undefined)
      style.foreground = probed.foreground;
    for (const f of STYLE_FLAGS)
      if (fromTheme[f] === undefined && probed[f] !== undefined) style[f] = probed[f];
  }

  semStyleCache.set(key, style);
  return style;
}

// ---------- comparison ----------
type Aspect = "foreground" | StyleFlag;
interface Finding {
  lang: string;
  file: string;
  line: number;
  text: string;
  type: string;
  modifiers: string[];
  aspect: Aspect;
  tm: string;
  sem: string;
  /** true when semantic had no own rule and the default scope map decided */
  viaScopeFallback: boolean;
}

const observedCombos = new Set<string>();

/** does any semanticTokenColors rule match this token at all? */
function hasOwnSemanticRule(type: string, modifiers: string[], lang: string): boolean {
  const hierarchy = typeHierarchy(type);
  return semanticEntries.some(([sel]) => {
    const [selPart, selLang] = sel.split(":");
    const [selType, ...selMods] = selPart.split(".");
    if (selType !== "*" && !hierarchy.includes(selType)) return false;
    if (selLang && selLang !== "*" && selLang !== lang) return false;
    return selMods.every((m) => modifiers.includes(m));
  });
}

function compare(
  languageId: string,
  fileLabel: string,
  text: string,
  tmLines: TmLine[],
  sem: SemToken[]
): { findings: Finding[]; corrections: number } {
  const lines = splitLines(text);
  const colorMap = registry.getColorMap().map((c) => (c ?? "").toLowerCase());
  const findings: Finding[] = [];
  let corrections = 0;

  for (const t of sem) {
    observedCombos.add(`${languageId}|${[t.type, ...t.modifiers.slice().sort()].join(".")}`);
    const style = semStyle(t.type, t.modifiers, languageId);
    const viaScopeFallback = !hasOwnSemanticRule(t.type, t.modifiers, languageId);
    if (style.foreground === undefined && STYLE_FLAGS.every((f) => style[f] === undefined))
      continue; // semantic decides nothing -> TM stands, never a flicker

    // item 18: every TM token overlapping [start, start+len), not just the one
    // containing `start` - a color change mid-span is just as visible.
    const end = t.start + t.len;
    const overlapping = (tmLines[t.line]?.colors ?? []).filter((k) => k.s < end && t.start < k.e);
    const seen = new Set<string>();
    for (const tmTok of overlapping) {
      const tmFg = colorMap[tmTok.c] || editorFg;
      const dedupe = `${tmFg}|${tmTok.fs}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      const tmFlags: Record<StyleFlag, boolean> = {
        italic: (tmTok.fs & FS_ITALIC) !== 0,
        bold: (tmTok.fs & FS_BOLD) !== 0,
        underline: (tmTok.fs & FS_UNDERLINE) !== 0,
        strikethrough: (tmTok.fs & FS_STRIKETHROUGH) !== 0,
      };
      // "TM made no decision here": plain foreground and no font style. Only
      // then may semantic paint freely (docs/PHILOSOPHY.md §4).
      const tmUndecided = tmFg === editorFg && tmTok.fs === 0;

      const changes: Array<{ aspect: Aspect; tm: string; sem: string }> = [];
      if (style.foreground !== undefined && style.foreground !== tmFg)
        changes.push({ aspect: "foreground", tm: tmFg, sem: style.foreground });
      for (const f of STYLE_FLAGS) {
        const s = style[f];
        if (s !== undefined && s !== tmFlags[f])
          changes.push({ aspect: f, tm: String(tmFlags[f]), sem: String(s) });
      }
      if (changes.length === 0) continue;
      if (tmUndecided) {
        corrections++;
        continue;
      }

      for (const ch of changes) {
        const idx = allow.findIndex(
          (a) =>
            langMatches(a, languageId) &&
            a.type === t.type &&
            (a.modifiers ?? []).every((m) => t.modifiers.includes(m)) &&
            (!a.tmColor || a.tmColor === tmFg) &&
            // a colour-only allow entry does not excuse a fontStyle flicker
            allowAspects(a).includes(ch.aspect)
        );
        if (idx >= 0) {
          allowHits[idx]++;
          continue;
        }
        findings.push({
          lang: languageId,
          file: fileLabel,
          line: t.line + 1,
          text: (lines[t.line] ?? "").slice(t.start, end),
          type: t.type,
          modifiers: t.modifiers,
          aspect: ch.aspect,
          tm: ch.tm,
          sem: ch.sem,
          viaScopeFallback,
        });
      }
    }
  }
  return { findings, corrections };
}

const listFiles = (dir: string, ext: string): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f));

// ---------- item 23: the hand-copied build script fixture must not rot ------
{
  const real = join(root, "scripts/build-jetbrains.ts");
  const copy = join(root, "audit/fixtures/ts/real-build-jetbrains.ts");
  if (readFileSync(real, "utf8") !== readFileSync(copy, "utf8"))
    fail(
      "STALE FIXTURE: audit/fixtures/ts/real-build-jetbrains.ts no longer matches " +
        "scripts/build-jetbrains.ts. This fixture exists to run the audit over real, " +
        "non-toy code; a rotted copy audits code nobody ships. Re-copy it:\n" +
        "    cp scripts/build-jetbrains.ts audit/fixtures/ts/real-build-jetbrains.ts"
    );
}

// ---------- run ----------
const findings: Finding[] = [];
let corrections = 0;
let semTotal = 0;

const checkNonEmpty = (file: string, count: number): void => {
  const rel = relative(root, file);
  if (count > 0) return;
  const excuse = zeroSemanticAllow[rel];
  if (excuse) return;
  fail(
    `NO SEMANTIC TOKENS: ${rel} produced 0 semantic tokens. The language server ` +
      `answered but saw nothing - the fixture is silently not being audited. Fix the ` +
      `fixture/server, or add it to audit/zero-semantic-allow.json with a reason.`
  );
};

// Go: one gopls session per module dir
const goRoot = join(root, "audit/fixtures/go");
for (const sub of readdirSync(goRoot)) {
  const dir = join(goRoot, sub);
  if (!statSync(dir).isDirectory()) continue;
  const session = new SemanticSession("gopls", [], dir, { semanticTokens: true }, { semanticTokens: true });
  try {
    for (const file of listFiles(dir, ".go")) {
      const text = readFileSync(file, "utf8");
      const tmLines = await tmTokenize("go", text);
      recordRuleCoverage(tmLines);
      const sem = await session.tokens(file, "go", text);
      checkNonEmpty(file, sem.length);
      semTotal += sem.length;
      const r = compare("go", relative(root, file), text, tmLines, sem);
      findings.push(...r.findings);
      corrections += r.corrections;
    }
  } finally {
    session.kill();
  }
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
  try {
    const files = readdirSync(dir)
      .map((f) => join(dir, f))
      .filter((f) => EXT_LANG[f.slice(f.lastIndexOf("."))]);
    for (const file of files) {
      const { grammar, languageId } = EXT_LANG[file.slice(file.lastIndexOf("."))];
      const text = readFileSync(file, "utf8");
      const tmLines = await tmTokenize(grammar, text);
      recordRuleCoverage(tmLines);
      const sem = await session.tokens(file, languageId, text);
      checkNonEmpty(file, sem.length);
      semTotal += sem.length;
      const r = compare(languageId, relative(root, file), text, tmLines, sem);
      findings.push(...r.findings);
      corrections += r.corrections;
    }
  } finally {
    session.kill();
  }
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
  const label = f.aspect === "foreground" ? "" : ` ${f.aspect}`;
  console.log(
    `VIOLATION [${f.lang}] ${f.file}:${f.line} "${f.text}" ` +
      `${f.type}${f.modifiers.length ? "." + f.modifiers.join(".") : ""} ` +
      `TM${label} ${f.tm} -> semantic${label} ${f.sem}` +
      (f.viaScopeFallback ? "  (via default scope map - no semanticTokenColors rule)" : "")
  );
}

// stale allow entries (item 13)
const stale = allow.map((a, i) => ({ a, i })).filter(({ i }) => allowHits[i] === 0);
if (stale.length) {
  const lines = stale
    .map(({ a }) => `  ${describeAllow(a)}\n      reason: ${a.reason}`)
    .join("\n");
  const msg =
    `STALE ALLOW ENTRY: ${stale.length} audit/allow.json entr${stale.length === 1 ? "y" : "ies"} ` +
    `never matched a single token in this run. An allow entry that excuses nothing is a ` +
    `blanket permission for a future flicker - delete it, or add a fixture that exercises it.\n` +
    lines;
  if (UPDATE) console.log("\n(--update) " + msg);
  else fail(msg);
}

// semantic combo coverage vs snapshot (item 19: both directions)
const comboPath = join(root, "audit/coverage-semantic.json");
const combos = [...observedCombos].sort();
let newCombos: string[] = [];
let lostCombos: string[] = [];
try {
  const known: string[] = JSON.parse(readFileSync(comboPath, "utf8"));
  newCombos = combos.filter((c) => !known.includes(c));
  lostCombos = known.filter((c) => !combos.includes(c));
} catch {
  newCombos = combos;
}
if (UPDATE) {
  writeFileSync(comboPath, JSON.stringify(combos, null, 2) + "\n");
} else {
  if (newCombos.length) {
    console.log(
      `\nNEW semantic type/modifier combos (unaudited color paths — review, then run with --update):`
    );
    for (const c of newCombos) console.log(`  ${c}`);
    fail(`${newCombos.length} new semantic combo(s) not in audit/coverage-semantic.json`);
  }
  if (lostCombos.length) {
    console.log(
      `\nLOST semantic type/modifier combos (the server stopped emitting these — a fixture or a ` +
        `server capability regressed; confirm intentional, then run with --update):`
    );
    for (const c of lostCombos) console.log(`  ${c}`);
    fail(`${lostCombos.length} semantic combo(s) in the snapshot are no longer observed`);
  }
}

// TM selector coverage (item 19: growth of the unexercised list is a failure)
const tmCoveragePath = join(root, "audit/coverage-tm.json");
const unexercised = allSelectors.filter((_, i) => !selectorFired[i]).sort();
let newlyUnexercised: string[] = [];
let newlyExercised: string[] = [];
try {
  const known: string[] = JSON.parse(readFileSync(tmCoveragePath, "utf8"));
  newlyUnexercised = unexercised.filter((s) => !known.includes(s));
  newlyExercised = known.filter((s) => !unexercised.includes(s));
} catch {
  newlyUnexercised = unexercised;
}
if (UPDATE) {
  writeFileSync(tmCoveragePath, JSON.stringify(unexercised, null, 2) + "\n");
} else {
  if (newlyUnexercised.length) {
    console.log(`\nTM selectors that USED to be exercised and no longer are:`);
    for (const s of newlyUnexercised) console.log(`  ${s}`);
    fail(
      `TM COVERAGE REGRESSION: ${newlyUnexercised.length} selector(s) lost fixture coverage ` +
        `(audit/coverage-tm.json grew). Restore the fixture, or accept with --update.`
    );
  }
  if (newlyExercised.length) {
    console.log(
      `\nTM selectors newly exercised (${newlyExercised.length}) — good news; run with --update ` +
        `to shrink audit/coverage-tm.json.`
    );
  }
}

console.log(`\nsemantic tokens: ${semTotal} (corrections of plain tokens: ${corrections})`);
console.log(`semantic combos observed: ${combos.length} (${newCombos.length} new, ${lostCombos.length} lost vs snapshot)`);
console.log(
  `TM selectors exercised: ${selectorFired.filter(Boolean).length}/${allSelectors.length} ` +
    `(unexercised list -> audit/coverage-tm.json)`
);
console.log(`allow.json entries: ${allow.length} (${stale.length} unused)`);
console.log(`py/sh TM-only tokens: ${tmOnlyTokens}`);
console.log(`violations: ${findings.length}`);

if (errors.length) {
  console.log("");
  for (const e of errors) console.log(e + "\n");
}
process.exit(findings.length > 0 || errors.length > 0 ? 1 : 0);
