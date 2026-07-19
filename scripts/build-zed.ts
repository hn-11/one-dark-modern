#!/usr/bin/env node
// Build "Zed One Dark Modern": Zed's One Dark interpretation (desaturated
// palette, austere roles - variables unpainted, types cyan, tags blue) on
// the Dark Modern workbench.
//
// Source of truth: upstream/zed-one.json (zed-industries/zed, auto-synced).
// Unlike the ODP-based variants, the token layer here is authored fresh -
// a direct translation of Zed's syntax slots into TM scopes + semantic
// tokens, preserving Zed's philosophy (no color on plain variables, no
// italic comments).
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

// ---- workbench: Dark Modern chrome, Zed editor + terminal, Zed accent ----
const accent = z("text.accent"); // #74ade8
// recolor Dark Modern's #0078D4 accent keys to Zed's, preserving alpha
const chrome = Object.fromEntries(
  Object.entries(darkModern.colors).map(([k, v]) => {
    const lower = v.toLowerCase();
    return lower.startsWith("#0078d4") ? [k, accent + lower.slice(7)] : [k, v];
  })
);

const ansi = (name: string): string => z(`terminal.ansi.${name}`);
const colors: Record<string, string> = {
  ...chrome,
  "editor.background": z("editor.background"),
  "editor.foreground": s("primary"),
  "editor.lineHighlightBackground": trim(style["editor.active_line.background"] as string),
  "editor.selectionBackground": trim(players[0].selection),
  "editorCursor.foreground": trim(players[0].cursor),
  "editorLineNumber.foreground": trim(style["editor.line_number"] as string ?? "#636d83ff"),
  "editorLineNumber.activeForeground": trim(style["editor.active_line_number"] as string ?? "#abb2bfff"),
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
  rule(["constant.numeric", "constant.language"], s("number")),
  rule(["variable.other.constant", "constant.other"], s("constant")),
  rule(["entity.name.function", "support.function", "meta.function-call.generic"], s("function")),
  rule(
    ["entity.name.type", "entity.name.class", "support.type", "support.class", "entity.other.inherited-class", "support.type.primitive", "support.type.builtin"],
    s("type")
  ),
  rule(["variable.other.property", "variable.other.object.property", "support.variable.property", "support.type.property-name"], s("property")),
  rule("variable.parameter", s("variable.parameter")),
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

// ---- semantic: Zed roles; variables deliberately undefined (unpainted) ----
const semanticTokenColors: Record<string, unknown> = {
  keyword: s("keyword"),
  operator: s("operator"),
  string: s("string"),
  regexp: s("string.regex"),
  number: s("number"),
  comment: s("comment"),
  function: s("function"),
  method: s("function"),
  class: s("type"),
  interface: s("type"),
  struct: s("type"),
  enum: s("type"),
  type: s("type"),
  typeParameter: s("type"),
  property: s("property"),
  parameter: s("variable.parameter"),
  enumMember: s("constant"),
  "variable.readonly": s("constant"),
};

const theme = {
  $schema: "vscode://schemas/color-theme",
  name: "Zed One Dark Modern",
  type: "dark",
  semanticHighlighting: true,
  colors: Object.fromEntries(Object.entries(colors).sort(([a], [b]) => a.localeCompare(b))),
  tokenColors,
  semanticTokenColors,
};
writeFileSync(
  join(root, "themes/zed-one-dark-modern-color-theme.json"),
  JSON.stringify(theme, null, 2) + "\n"
);
console.log(
  `built Zed One Dark Modern: ${Object.keys(colors).length} colors, ${tokenColors.length} token rules, ${Object.keys(semanticTokenColors).length} semantic`
);
