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
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  readJson as read,
  recolor,
  root,
  validateColorMap,
  validateSemanticSource,
  validateSyntaxRules,
  type SemanticEntryShape,
  type SyntaxRuleShape,
  type Theme,
} from "./lib.ts";

type SyntaxRule = SyntaxRuleShape;

const darkModern = read<Theme>("upstream/dark_modern.json");
const dark2026 = read<Theme>("upstream/2026-dark.json");
const ovColors = validateColorMap("overrides/colors.json", read<unknown>("overrides/colors.json"));
const ovColors2026 = validateColorMap(
  "overrides/colors-2026.json",
  read<unknown>("overrides/colors-2026.json")
);
const accent2026 = validateColorMap(
  "overrides/accent-2026.json",
  read<unknown>("overrides/accent-2026.json")
);

// ---- syntax: the theme's own source of truth (shared by both variants) ----
// syntax/families.json is the color vocabulary (docs/PHILOSOPHY.md section 2);
// every token rule names a family instead of a hex, so a color exists in
// exactly one place and a rule cannot use a color outside the vocabulary.
// Rule order is significant (VS Code resolves equal-specificity scopes with
// last-rule-wins).
const families = validateColorMap("syntax/families.json", read<unknown>("syntax/families.json"));
const syntaxRules = validateSyntaxRules(read<unknown>("syntax/tokens.json"), families);
// a scope may appear exactly once across all rules: a repeat is either dead
// weight (same rule) or an invisible last-rule-wins conflict (different rule)
const seenScopes = new Map<string, string>();
for (const rule of syntaxRules) {
  for (const scope of rule.scope) {
    const prev = seenScopes.get(scope);
    if (prev !== undefined) {
      throw new Error(
        `duplicate scope "${scope}" (families: ${prev}, ${rule.family})`
      );
    }
    seenScopes.set(scope, rule.family);
  }
}
const tokenColors = syntaxRules.map(({ family, scope, settings }) => {
  if (family !== "style-only" && !(family in families)) {
    throw new Error(`unknown family "${family}" for scope ${scope[0]}`);
  }
  const merged = {
    ...(family === "style-only" ? {} : { foreground: families[family] }),
    ...(settings ?? {}),
  };
  return { scope, settings: merged };
});
// semantic rules also reference families by name; the build resolves them,
// so hex values exist in exactly one file: syntax/families.json
type SemanticSource = SemanticEntryShape;
const semanticSource = validateSemanticSource(read<unknown>("syntax/semantic.json"), families);
const semanticTokenColors = Object.fromEntries(
  Object.entries(semanticSource).map(([key, { family, ...styles }]) => {
    if (!(family in families)) {
      throw new Error(`semantic "${key}": unknown family ${family}`);
    }
    const fg = families[family];
    return [key, Object.keys(styles).length ? { foreground: fg, ...styles } : fg];
  })
);

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
  mkdirSync(join(root, "themes"), { recursive: true });
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
