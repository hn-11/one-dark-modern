#!/usr/bin/env node
// Build themes/one-dark-modern-color-theme.json from upstream snapshots + overrides.
//
//   upstream/dark_modern.json   Dark Modern (microsoft/vscode)  -> workbench colors base
//   upstream/OneDark-Pro.json   One Dark Pro (Binaryify)        -> token colors base
//   overrides/colors.json       our color overrides (One Dark editor/terminal, fixes)
//   overrides/tokens.json       our token rules (same scope replaces the upstream rule)
//   overrides/semantic.json     our semantic token overrides
//
// The theme file is generated - edit overrides/ instead. Run: npm run build
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJson as read, root, type Theme, type TokenRule } from "./lib.ts";

const darkModern = read<Theme>("upstream/dark_modern.json");
const oneDarkPro = read<Theme>("upstream/OneDark-Pro.json");
const ovColors = read<Record<string, string>>("overrides/colors.json");
const ovTokens = read<TokenRule[]>("overrides/tokens.json");
const ovSemantic = read<Record<string, unknown>>("overrides/semantic.json");

// ---- colors: Dark Modern base + our overrides ----
const colors = Object.fromEntries(
  Object.entries({ ...darkModern.colors, ...ovColors }).sort(([a], [b]) =>
    a.localeCompare(b)
  )
);

// ---- tokens: One Dark Pro base + our rules appended ----
// VS Code resolves equal-specificity scopes with last-rule-wins, so an
// appended override with the same scope replaces the upstream rule.
const scopeKey = (r: TokenRule): string =>
  Array.isArray(r.scope) ? r.scope.join(",") : r.scope;
const overridden = new Set(ovTokens.map(scopeKey));
// Drop upstream rules an override replaces, and dead exact duplicates
// (keep the last occurrence: that is the one VS Code applies).
const lastIndex = new Map<string, number>();
oneDarkPro.tokenColors.forEach((r, i) => lastIndex.set(scopeKey(r), i));
const tokenColors = oneDarkPro.tokenColors
  .filter((r, i) => lastIndex.get(scopeKey(r)) === i && !overridden.has(scopeKey(r)))
  .concat(ovTokens);

// ---- semantic: One Dark Pro base + our overrides ----
const semanticTokenColors = {
  ...(oneDarkPro.semanticTokenColors ?? {}),
  ...ovSemantic,
};

const theme = {
  $schema: "vscode://schemas/color-theme",
  name: "One Dark Modern",
  type: "dark",
  semanticHighlighting: true,
  colors,
  tokenColors,
  semanticTokenColors,
};

writeFileSync(
  join(root, "themes/one-dark-modern-color-theme.json"),
  JSON.stringify(theme, null, 2) + "\n"
);
console.log(
  `built: ${Object.keys(colors).length} colors (${Object.keys(ovColors).length} overridden), ` +
    `${tokenColors.length} token rules (${ovTokens.length} ours), ` +
    `${Object.keys(semanticTokenColors).length} semantic entries (${Object.keys(ovSemantic).length} ours)`
);
