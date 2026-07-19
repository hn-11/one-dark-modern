#!/usr/bin/env node
// Build the Zed-interpretation variants: "Zed One Dark Modern" and
// "Zed One Dark 2026".
//
// Policy: backgrounds belong to the UI generation (Dark Modern / 2026 Dark);
// the interpretation layer (Zed) only brings text colors, terminal palette,
// selection and accent. Zed's editor background is deliberately NOT copied.
//
// Source of truth: upstream/zed-one.json (zed-industries/zed, auto-synced).
// The token layer is authored fresh - a direct translation of Zed's syntax
// slots into TM scopes + semantic tokens, preserving Zed's philosophy
// (no color on plain variables, no italic comments).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJson, root, type Theme } from "./lib.ts";

interface ZedFile {
  themes: Array<{ name: string; style: Record<string, unknown> }>;
}
const style = readJson<ZedFile>("upstream/zed-one.json").themes.find((t) =>
  /dark/i.test(t.name)
)!.style as Record<string, unknown>;
const darkModern = readJson<Theme>("upstream/dark_modern.json");
const dark2026 = readJson<Theme>("upstream/2026-dark.json");
const accent2026 = readJson<Record<string, string>>("overrides/accent-2026.json");

interface ZedSemRule {
  token_type?: string;
  token_modifiers?: string[];
  style?: string[];
  foreground_color?: string;
  font_style?: string;
}
const zedDefaultRules = readJson<ZedSemRule[]>("upstream/zed-semantic-default.json");
const zedGoRules = readJson<ZedSemRule[]>("upstream/zed-semantic-go.json");

// zed colors are #rrggbbaa; drop the alpha when it is opaque
const trim = (v: string): string => (v.toLowerCase().endsWith("ff") ? v.slice(0, 7) : v);
const z = (key: string): string => {
  const v = style[key];
  if (typeof v !== "string") throw new Error(`zed style missing: ${key}`);
  return trim(v);
};
const syntax = style.syntax as Record<string, { color: string; font_style?: string }>;
const s = (slot: string): string => {
  const v = syntax[slot]?.color;
  if (!v) throw new Error(`zed syntax missing: ${slot}`);
  return trim(v);
};
const players = style.players as Array<{ cursor: string; selection: string }>;
const accent = z("text.accent"); // #74ade8

// channel-ratio scaling: derive a family member of `target` that relates to
// it the way `member` relates to `base` (same approach as accent-2026.json)
const scale = (target: string, member: string, base: string): string => {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const v = Math.min(255, Math.round(ch(target, i) * (ch(member, i) / ch(base, i))));
    out += v.toString(16).padStart(2, "0");
  }
  return out;
};

// accent recolor maps per UI generation, targeting Zed's accent
const TEAL_PRIMARY = "#3994BC";
const zedAccentMap: Record<string, string> = { "#0078d4": accent };
for (const teal of Object.keys(accent2026)) {
  const t = teal.toLowerCase();
  if (t === "#0078d4") continue;
  zedAccentMap[t] = t === TEAL_PRIMARY.toLowerCase() ? accent : scale(accent, t, TEAL_PRIMARY.toLowerCase());
}
const recolor = (colors: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(colors).map(([k, v]) => {
      const lower = v.toLowerCase();
      for (const [from, to] of Object.entries(zedAccentMap)) {
        if (lower.startsWith(from)) return [k, to + lower.slice(from.length)];
      }
      return [k, v];
    })
  );

// ---- Zed identity: text, terminal, selection - no backgrounds ----
const ansi = (name: string): string => z(`terminal.ansi.${name}`);
const zedIdentity: Record<string, string> = {
  // selection/focus surfaces: Dark Modern leaves these to VS Code's legacy
  // defaults (#04395E-family blues) which clash with Zed's accent - use
  // Zed's real element colors (muted grays + focused border) instead
  "list.activeSelectionBackground": z("element.selected"),
  "list.inactiveSelectionBackground": z("ghost_element.hover"),
  "list.hoverBackground": z("ghost_element.hover"),
  "quickInputList.focusBackground": z("element.selected"),
  "editorSuggestWidget.selectedBackground": z("element.selected"),
  "menu.selectionBackground": z("element.selected"),
  "menu.selectionForeground": z("terminal.bright_foreground"),
  "list.focusOutline": z("border.focused"),
  "inputOption.activeBorder": z("border.focused"),
  "inputOption.activeBackground": trim(players[0].selection),
  "editor.foreground": s("primary"),
  "editor.selectionBackground": trim(players[0].selection),
  "editorCursor.foreground": trim(players[0].cursor),
  "textLink.foreground": accent,
  "textLink.activeForeground": accent,
  "terminal.foreground": z("terminal.foreground"),
  "terminal.ansiBlack": ansi("black"),
  "terminal.ansiRed": ansi("red"),
  "terminal.ansiGreen": ansi("green"),
  "terminal.ansiYellow": ansi("yellow"),
  "terminal.ansiBlue": ansi("blue"),
  "terminal.ansiMagenta": ansi("magenta"),
  "terminal.ansiCyan": ansi("cyan"),
  "terminal.ansiWhite": ansi("white"),
  "terminal.ansiBrightBlack": ansi("bright_black"),
  "terminal.ansiBrightRed": ansi("bright_red"),
  "terminal.ansiBrightGreen": ansi("bright_green"),
  "terminal.ansiBrightYellow": ansi("bright_yellow"),
  "terminal.ansiBrightBlue": ansi("bright_blue"),
  "terminal.ansiBrightMagenta": ansi("bright_magenta"),
  "terminal.ansiBrightCyan": ansi("bright_cyan"),
  "terminal.ansiBrightWhite": ansi("bright_white"),
};

// ---- tokens: fresh translation of Zed's slots (no ODP inheritance) ----
const rule = (scope: string | string[], foreground: string, fontStyle?: string) => ({
  scope,
  settings: fontStyle ? { foreground, fontStyle } : { foreground },
});
const tokenColors = [
  // Zed does not italicize comments - neither do we here
  rule(["comment", "punctuation.definition.comment"], s("comment")),
  rule("comment.block.documentation", s("comment.doc")),
  rule(["keyword", "storage", "meta.preprocessor keyword", "keyword.operator.word", "keyword.operator.expression", "keyword.operator.new"], s("keyword")),
  rule("keyword.operator", s("operator")),
  rule("string", s("string")),
  rule("constant.character.escape", s("string.escape")),
  rule("string.regexp", s("string.regex")),
  rule("constant.numeric", s("number")),
  rule("constant.language.boolean", s("boolean")),
  rule(["constant.language.null", "constant.language.undefined"], s("constant")),
  rule(["variable.other.constant", "constant.other"], s("constant")),
  rule(["entity.name.function", "support.function", "meta.function-call.generic"], s("function")),
  rule("storage.type.function.arrow", s("operator")),
  rule(["keyword.operator.type", "keyword.operator.optional"], s("punctuation.special")),
  rule(
    ["entity.name.type", "entity.name.class", "entity.other.inherited-class", "support.type.primitive", "support.type.builtin"],
    s("type")
  ),
  rule(["entity.name.namespace", "entity.name.package", "entity.name.type.package"], s("namespace")),
  rule(["variable.other.property", "variable.other.object.property", "support.variable.property", "support.type.property-name"], s("property")),
  rule("variable.parameter", s("variable.parameter")),
  rule("variable.language", s("variable.special")),
  rule("variable.other.enummember", s("property")),
  rule("meta.template.expression", s("primary")),
  rule(["punctuation.separator", "punctuation.accessor", "punctuation.terminator", "punctuation.other"], s("punctuation.delimiter")),
  rule(
    ["meta.brace", "punctuation.definition.block", "punctuation.definition.parameters", "punctuation.definition.typeparameters", "punctuation.definition.arguments", "punctuation.definition.array", "punctuation.section", "punctuation.definition.begin", "punctuation.definition.end", "punctuation.definition.bracket", "punctuation.definition.binding-pattern", "punctuation.definition.imports"],
    s("punctuation.bracket")
  ),
  rule("entity.name.tag", s("tag")),
  rule("entity.other.attribute-name", s("attribute")),
  rule("entity.name.label", s("label")),
  rule(["punctuation.section.embedded", "punctuation.definition.template-expression"], s("punctuation.special")),
  rule("markup.heading", s("title")),
  rule(["markup.bold", "punctuation.definition.bold"], s("emphasis.strong")),
  rule(["markup.italic", "punctuation.definition.italic"], s("emphasis"), "italic"),
  rule(["markup.inline.raw", "markup.raw"], s("text.literal")),
  rule(["markup.underline.link", "string.other.link"], s("link_uri")),
  rule("markup.inserted", s("string")),
  rule("markup.deleted", s("property")),
  rule("invalid.illegal", "#ffffff"),
  // shell: keep the terminal-like feel consistent with our other variants
  rule(["entity.name.command.shell", "support.function.builtin.shell"], s("string")),
  rule("constant.other.option", s("operator")),
  rule("string.unquoted.argument", s("primary")),
];

// ---- semantic: mechanical translation of Zed's combined-mode rules ----
// (semantic_tokens: "combined" in Zed). A rule's style list is tried in
// order; the first slot the theme defines wins. Rules whose styles resolve
// to nothing are inapplicable - exactly Zed's fallthrough behavior.
const resolveStyle = (rule: ZedSemRule): string | null => {
  if (rule.foreground_color) return rule.foreground_color.toLowerCase();
  for (const slot of rule.style ?? []) if (syntax[slot]) return trim(syntax[slot].color);
  return null;
};
const semanticTokenColors: Record<string, unknown> = {};
const addRules = (rules: ZedSemRule[], langSuffix: string): void => {
  for (const rule of rules) {
    if (!rule.token_type) continue; // no catch-all selector in VS Code
    const color = resolveStyle(rule);
    if (!color) continue;
    const sel =
      rule.token_type +
      (rule.token_modifiers?.length ? "." + rule.token_modifiers.join(".") : "") +
      langSuffix;
    if (sel in semanticTokenColors) continue; // first rule wins, like Zed
    semanticTokenColors[sel] =
      rule.font_style === "italic" ? { foreground: color, italic: true } : color;
  }
};
addRules(zedGoRules, ":go");
addRules(zedDefaultRules, "");

const buildVariant = (name: string, file: string, chrome: Record<string, string>): void => {
  const theme = {
    $schema: "vscode://schemas/color-theme",
    name,
    type: "dark",
    semanticHighlighting: true,
    colors: Object.fromEntries(
      Object.entries({ ...recolor(chrome), ...zedIdentity }).sort(([a], [b]) => a.localeCompare(b))
    ),
    tokenColors,
    semanticTokenColors,
  };
  writeFileSync(join(root, "themes", file), JSON.stringify(theme, null, 2) + "\n");
  console.log(`built ${name}: ${Object.keys(theme.colors).length} colors`);
};

buildVariant("Zed One Dark Modern", "zed-one-dark-modern-color-theme.json", darkModern.colors);
buildVariant("Zed One Dark 2026", "zed-one-dark-2026-color-theme.json", {
  ...darkModern.colors,
  ...dark2026.colors,
});
