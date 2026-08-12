#!/usr/bin/env node
// Resolution oracle: dump the color the real TextMate engine gives every
// fixture token, plus the resolution of every selector in the theme.
// Not part of CI - this is the refactoring tool: snapshot before a syntax/
// restructure, snapshot after, diff. Identical output = the restructure
// cannot have changed what users see (proved this way for v0.1.0 vendoring
// and the v0.1.1 288->14 merge).
//
//   node scripts/oracle.ts > /tmp/before.txt
//   ...refactor + npm run build...
//   node scripts/oracle.ts > /tmp/after.txt
//   diff /tmp/before.txt /tmp/after.txt
//
// Two flags turn the same dump into a CI guard against *unintended* color
// changes (docs/IMPROVEMENT-IDEAS.md item 21):
//
//   node scripts/oracle.ts --check   compare against audit/oracle-snapshot.txt
//   node scripts/oracle.ts --write   regenerate that snapshot
//
// A deliberate color change is expected to fail --check; the fix is to run
// --write and review the diff as part of the change.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type * as tmTypes from "vscode-textmate";
import { readJson, root, type Theme } from "./lib.ts";

const SNAPSHOT = "audit/oracle-snapshot.txt";
const args = process.argv.slice(2);
const mode = args.includes("--check") ? "check" : args.includes("--write") ? "write" : "print";
const unknown = args.filter((a) => a !== "--check" && a !== "--write");
if (unknown.length > 0) {
  console.error(`oracle: unknown argument(s): ${unknown.join(", ")}`);
  process.exit(2);
}
// Default mode streams to stdout exactly as before; the snapshot modes
// buffer the same lines instead.
const lines: string[] = [];
const emit = (line: string): void => {
  if (mode === "print") console.log(line);
  else lines.push(line);
};

const require = createRequire(import.meta.url);
const tm = require("vscode-textmate");
const oniguruma = require("vscode-oniguruma");

const GRAMMARS: Record<string, { scope: string; file: string; ext: string[] }> = {
  go: { scope: "source.go", file: "go.tmLanguage.json", ext: [".go"] },
  ts: { scope: "source.ts", file: "TypeScript.tmLanguage.json", ext: [".ts"] },
  tsx: { scope: "source.tsx", file: "TypeScriptReact.tmLanguage.json", ext: [".tsx"] },
  js: { scope: "source.js", file: "JavaScript.tmLanguage.json", ext: [".js"] },
  jsx: { scope: "source.js.jsx", file: "JavaScriptReact.tmLanguage.json", ext: [".jsx"] },
  py: { scope: "source.python", file: "MagicPython.tmLanguage.json", ext: [".py"] },
  sh: { scope: "source.shell", file: "shell-unix-bash.tmLanguage.json", ext: [".sh"] },
  json: { scope: "source.json", file: "JSON.tmLanguage.json", ext: [".json"] },
  jsonc: { scope: "source.json.comments", file: "JSONC.tmLanguage.json", ext: [".jsonc"] },
  yaml: { scope: "source.yaml", file: "yaml.tmLanguage.json", ext: [".yaml", ".yml"] },
  md: { scope: "text.html.markdown", file: "markdown.tmLanguage.json", ext: [".md"] },
  css: { scope: "source.css", file: "css.tmLanguage.json", ext: [".css"] },
  // include-only sub-grammars (VS Code's YAML grammar dispatches per spec
  // version); no extension, so no fixture is ever tokenized with them directly
  "yaml-1.3": { scope: "source.yaml.1.3", file: "yaml-1.3.tmLanguage.json", ext: [] },
  "yaml-1.2": { scope: "source.yaml.1.2", file: "yaml-1.2.tmLanguage.json", ext: [] },
  "yaml-1.1": { scope: "source.yaml.1.1", file: "yaml-1.1.tmLanguage.json", ext: [] },
  "yaml-1.0": { scope: "source.yaml.1.0", file: "yaml-1.0.tmLanguage.json", ext: [] },
  "yaml-embedded": {
    scope: "source.yaml.embedded",
    file: "yaml-embedded.tmLanguage.json",
    ext: [],
  },
};

const theme = readJson<Theme>("themes/one-dark-modern-color-theme.json");

await oniguruma.loadWASM(
  readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm")).buffer
);
const registry = new tm.Registry({
  onigLib: Promise.resolve({
    createOnigScanner: (s: string[]) => new oniguruma.OnigScanner(s),
    createOnigString: (s: string) => new oniguruma.OnigString(s),
  }),
  loadGrammar: async (scopeName: string) => {
    const g = Object.values(GRAMMARS).find((g) => g.scope === scopeName);
    if (!g) return null;
    const p = join(root, "audit/grammars", g.file);
    return tm.parseRawGrammar(readFileSync(p, "utf8"), p);
  },
});
registry.setTheme({
  settings: [
    {
      settings: {
        foreground: theme.colors["editor.foreground"] ?? "#abb2bf",
        background: theme.colors["editor.background"] ?? "#1f1f1f",
      },
    },
    ...theme.tokenColors.map((r) => ({ scope: r.scope, settings: r.settings })),
  ],
});
const colorMap: string[] = registry.getColorMap();

// ---- part 1: every fixture token's engine-resolved color + font style ----
const files: string[] = [];
const walk = (d: string): void => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(join(root, "audit/fixtures"));

for (const f of files.sort()) {
  const g = Object.values(GRAMMARS).find((v) => v.ext.some((e) => f.endsWith(e)));
  if (!g) continue;
  const grammar = await registry.loadGrammar(g.scope);
  if (!grammar) continue;
  let stack: tmTypes.StateStack | null = null;
  // CRLF-tolerant: a stray \r would otherwise ride along on every line and
  // shift the reported column offsets (docs/IMPROVEMENT-IDEAS.md item 36)
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  for (let ln = 0; ln < lines.length; ln++) {
    const r: tmTypes.ITokenizeLineResult2 = grammar.tokenizeLine2(lines[ln], stack);
    stack = r.ruleStack;
    const d = r.tokens;
    for (let i = 0; i < d.length; i += 2) {
      const fg = (d[i + 1] & 0b00000000111111111000000000000000) >>> 15;
      const fs = (d[i + 1] & 0b00000000000000000111100000000000) >>> 11;
      emit(`${f.slice(root.length)}:${ln}:${d[i]}:${(colorMap[fg] ?? "").toLowerCase()}:${fs}`);
    }
  }
}

// ---- part 2: every selector in the theme, resolved as a leaf scope path ----
// (covers rules no fixture exercises; emulates the engine's specificity:
// deeper leaf match > more selector parts matched > longer leaf > later rule)
const flat: Array<{ sel: string; settings: { foreground?: string; fontStyle?: string } }> = [];
for (const r of theme.tokenColors) {
  const raw = Array.isArray(r.scope) ? r.scope : String(r.scope).split(",");
  for (const s of raw) {
    const t = s.trim();
    if (t) flat.push({ sel: t, settings: r.settings });
  }
}
const resolveLeaf = (path: string[]): string => {
  let best: { foreground?: string; fontStyle?: string } | null = null;
  let bl = -1, bd = -1, bi = -1;
  flat.forEach(({ sel, settings }, idx) => {
    const parts = sel.split(/\s+/);
    let i = 0, li = -1;
    for (let d = 0; d < path.length && i < parts.length; d++) {
      if (path[d] === parts[i] || path[d].startsWith(parts[i] + ".")) {
        i++;
        li = d;
      }
    }
    if (i === parts.length) {
      const spec = parts.length * 1000 + parts[parts.length - 1].length;
      if (li > bd || (li === bd && spec > bl) || (li === bd && spec === bl && idx > bi)) {
        best = settings;
        bl = spec;
        bd = li;
        bi = idx;
      }
    }
  });
  const s: { foreground?: string; fontStyle?: string } = best ?? {};
  return `${(s.foreground ?? "-").toLowerCase()}/${s.fontStyle ?? "-"}`;
};
for (const sel of [...new Set(flat.map((f) => f.sel))].sort()) {
  emit(`SEL ${sel} -> ${resolveLeaf(["source.x", ...sel.split(/\s+/)])}`);
}

// ---- snapshot modes ----
if (mode !== "print") {
  const current = lines.join("\n") + "\n";
  const path = join(root, SNAPSHOT);
  if (mode === "write") {
    writeFileSync(path, current);
    console.log(`oracle: wrote ${SNAPSHOT} (${lines.length} lines)`);
  } else {
    let expected: string;
    try {
      expected = readFileSync(path, "utf8");
    } catch {
      console.log(`oracle: no ${SNAPSHOT} - run \`npm run oracle -- --write\` to create it`);
      process.exit(1);
    }
    if (expected === current) {
      console.log(`oracle: snapshot matches (${lines.length} lines)`);
    } else {
      const exp = expected.split("\n");
      let shown = 0;
      for (let i = 0; i < Math.max(exp.length, lines.length); i++) {
        if (exp[i] === lines[i]) continue;
        if (shown++ >= 20) {
          console.log("  ... (further differences suppressed)");
          break;
        }
        console.log(`  -${exp[i] ?? "<eof>"}\n  +${lines[i] ?? "<eof>"}`);
      }
      console.log(
        `oracle: snapshot MISMATCH - resolved colors changed. If intended, ` +
          `run \`npm run oracle -- --write\` and review the diff.`
      );
      process.exit(1);
    }
  }
}
