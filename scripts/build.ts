#!/usr/bin/env node
// Build the VS Code themes from upstream snapshots + overrides.
//
//   upstream/dark_modern.json   Dark Modern (microsoft/vscode)  -> UI base of "One Dark Modern"
//   upstream/2026-dark.json     2026 Dark (includes dark_modern) -> UI base of "One Dark 2026"
//   upstream/OneDark-Pro.json   One Dark Pro (Binaryify)        -> token colors base (shared)
//   overrides/colors.json       our color overrides, shared by both variants
//   overrides/colors-2026.json  extra overrides applied only to One Dark 2026
//   overrides/tokens.json       our token rules (same scope replaces the upstream rule)
//   overrides/semantic.json     our semantic token overrides
//
// The theme files are generated - edit overrides/ instead. Run: npm run build
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJson as read, root, type Theme, type TokenRule } from "./lib.ts";

const darkModern = read<Theme>("upstream/dark_modern.json");
const dark2026 = read<Theme>("upstream/2026-dark.json");
const oneDarkPro = read<Theme>("upstream/OneDark-Pro.json");
const ovColors = read<Record<string, string>>("overrides/colors.json");
const ovColors2026 = read<Record<string, string>>("overrides/colors-2026.json");
const ovTokens = read<TokenRule[]>("overrides/tokens.json");
const ovSemantic = read<Record<string, unknown>>("overrides/semantic.json");

// ---- tokens: One Dark Pro base + our rules appended (shared by variants) ----
// VS Code resolves equal-specificity scopes with last-rule-wins, so an
// appended override with the same scope replaces the upstream rule.
// (Upstream UI themes carry their own tokenColors; we ignore them - syntax
// identity comes from One Dark Pro by design.)
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

// ---- semantic: One Dark Pro base + our overrides (shared) ----
const semanticTokenColors = {
  ...(oneDarkPro.semanticTokenColors ?? {}),
  ...ovSemantic,
};

const buildVariant = (
  name: string,
  file: string,
  uiLayers: Array<Record<string, string>>
): void => {
  const colors = Object.fromEntries(
    Object.entries(Object.assign({}, ...uiLayers)).sort(([a], [b]) =>
      a.localeCompare(b)
    )
  );
  const theme = {
    $schema: "vscode://schemas/color-theme",
    name,
    type: "dark",
    semanticHighlighting: true,
    colors,
    tokenColors,
    semanticTokenColors,
  };
  writeFileSync(join(root, "themes", file), JSON.stringify(theme, null, 2) + "\n");
  console.log(`built ${name}: ${Object.keys(colors).length} colors`);
};

// One Dark Modern: Dark Modern UI + shared One Dark overrides
buildVariant("One Dark Modern", "one-dark-modern-color-theme.json", [
  darkModern.colors,
  ovColors,
]);
// One Dark 2026: 2026 Dark includes dark_modern upstream, so resolve the
// include chain the same way VS Code does, then apply our overrides.
buildVariant("One Dark 2026", "one-dark-2026-color-theme.json", [
  darkModern.colors,
  dark2026.colors,
  ovColors,
  ovColors2026,
]);
console.log(
  `shared: ${tokenColors.length} token rules (${ovTokens.length} ours), ` +
    `${Object.keys(semanticTokenColors).length} semantic entries (${Object.keys(ovSemantic).length} ours)`
);
