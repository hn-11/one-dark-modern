#!/usr/bin/env node
// Build the VS Code themes from upstream UI snapshots + our own syntax source.
//
//   upstream/dark_modern.json   Dark Modern (microsoft/vscode)  -> UI base of "One Dark Modern"
//   upstream/2026-dark.json     2026 Dark (includes dark_modern) -> UI base of "One Dark 2026"
//   syntax/tokens.json          the theme's own TextMate rules (family-annotated;
//                               vendored from a decade of One Dark Pro tuning at
//                               v0.1.0, curated under docs/PHILOSOPHY.md since)
//   syntax/semantic.json        the theme's own semantic token rules
//   overrides/colors.json       our UI color overrides, shared by both variants
//   overrides/colors-2026.json  extra overrides applied only to One Dark 2026
//   overrides/accent-2026.json  accent recolor map for One Dark 2026: any
//                               upstream value with a listed RGB is replaced
//                               (alpha preserved), so new accent keys added
//                               upstream are remapped automatically
//
// The theme files are generated - edit syntax/ and overrides/ instead.
// Run: npm run build
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJson as read, root, type Theme, type TokenRule } from "./lib.ts";

type SyntaxRule = TokenRule & { family: string };

const darkModern = read<Theme>("upstream/dark_modern.json");
const dark2026 = read<Theme>("upstream/2026-dark.json");
const ovColors = read<Record<string, string>>("overrides/colors.json");
const ovColors2026 = read<Record<string, string>>("overrides/colors-2026.json");
const accent2026 = read<Record<string, string>>("overrides/accent-2026.json");

// value-level recolor: replace the RGB part, keep any alpha suffix
const recolor = (colors: Record<string, string>, map: Record<string, string>): Record<string, string> => {
  const rules = Object.entries(map).map(([from, to]) => ({
    from: from.toLowerCase(),
    to: to.toLowerCase(),
  }));
  return Object.fromEntries(
    Object.entries(colors).map(([k, v]) => {
      const lower = v.toLowerCase();
      for (const { from, to } of rules) {
        if (lower.startsWith(from)) return [k, to + lower.slice(from.length)];
      }
      return [k, v];
    })
  );
};

// ---- syntax: the theme's own source of truth (shared by both variants) ----
// Rule order is significant (VS Code resolves equal-specificity scopes with
// last-rule-wins); the family field documents which vocabulary family a rule
// serves (docs/PHILOSOPHY.md section 2) and is stripped from the output.
const syntaxRules = read<SyntaxRule[]>("syntax/tokens.json");
const tokenColors = syntaxRules.map(({ family: _family, ...rule }) => rule);
const semanticTokenColors = read<Record<string, unknown>>("syntax/semantic.json");

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
// include chain the same way VS Code does, recolor the upstream accent to
// One Dark's (#528BFF, Atom's accent - already our cursor color), then
// apply our overrides.
buildVariant("One Dark 2026", "one-dark-2026-color-theme.json", [
  recolor({ ...darkModern.colors, ...dark2026.colors }, accent2026),
  ovColors,
  ovColors2026,
]);
console.log(
  `syntax: ${tokenColors.length} token rules, ` +
    `${Object.keys(semanticTokenColors).length} semantic entries`
);
