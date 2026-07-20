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
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type * as tmTypes from "vscode-textmate";
import { readJson, root, type Theme } from "./lib.ts";

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
  const lines = readFileSync(f, "utf8").split("\n");
  for (let ln = 0; ln < lines.length; ln++) {
    const r: tmTypes.ITokenizeLineResult2 = grammar.tokenizeLine2(lines[ln], stack);
    stack = r.ruleStack;
    const d = r.tokens;
    for (let i = 0; i < d.length; i += 2) {
      const fg = (d[i + 1] & 0b00000000111111111000000000000000) >>> 15;
      const fs = (d[i + 1] & 0b00000000000000000111100000000000) >>> 11;
      console.log(
        `${f.slice(root.length)}:${ln}:${d[i]}:${(colorMap[fg] ?? "").toLowerCase()}:${fs}`
      );
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
  console.log(`SEL ${sel} -> ${resolveLeaf(["source.x", ...sel.split(/\s+/)])}`);
}
