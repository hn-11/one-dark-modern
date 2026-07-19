#!/usr/bin/env node
// Generate a Vim / Neovim colorscheme from the built VS Code theme.
// Emits dist/vim/colors/one-dark-modern.vim. Install by copying to
// ~/.vim/colors/ or ~/.config/nvim/colors/, then :colorscheme one-dark-modern
// (requires termguicolors).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blend, loadBuiltTheme, root, semanticColor, tokenColor, uiColor } from "./lib.ts";

const theme = loadBuiltTheme();
const ui = (key: string, fallback: string): string => uiColor(theme, key, fallback);
const token = (scope: string, fallback: string): string => tokenColor(theme, scope, fallback);
const semantic = (key: string, fallback: string): string => semanticColor(theme, key, fallback);

// palette
const bg = ui("editor.background", "#1f1f1f");
const fg = ui("editor.foreground", "#abb2bf");
const panelBg = ui("sideBar.background", "#181818");
const border = ui("sideBar.border", "#2b2b2b");
const keyword = token("keyword", "#c678dd");
const str = token("string", "#98c379");
const num = token("constant.numeric", "#d19a66");
const comment = semantic("comment", "#7f848e");
const func = semantic("function", "#61afef");
const cls = semantic("class", "#e5c07b");
const variable = semantic("variable", "#e06c75");
const constant = semantic("variable.readonly", "#e5c07b");
const builtin = token("support.function", "#56b6c2");
const escape = token("constant.character.escape", "#56b6c2");
const operator = token("keyword.operator", "#abb2bf");
const errorFg = ui("errorForeground", "#f85149");
const warnFg = "#cca700";
const cursorLine = blend(ui("editor.lineHighlightBackground", "#2c313c"), bg);
const visual = blend(ui("editor.selectionBackground", "#67769660"), bg);
const search = blend(ui("editor.findMatchBackground", "#9e6a03"), bg);
const linkFg = ui("textLink.foreground", "#4daafc");

type Hi = { fg?: string; bg?: string; sp?: string; style?: string };
const hi = (group: string, o: Hi): string =>
  [
    `hi ${group}`,
    `guifg=${o.fg ?? "NONE"}`,
    `guibg=${o.bg ?? "NONE"}`,
    o.sp ? `guisp=${o.sp}` : "",
    `gui=${o.style ?? "NONE"} cterm=${o.style ?? "NONE"}`,
  ]
    .filter(Boolean)
    .join(" ");
const link = (from: string, to: string): string => `hi! link ${from} ${to}`;

const lines: string[] = [
  '" One Dark Modern - generated from the VS Code theme, do not edit',
  '" https://github.com/hn-11/one-dark-modern',
  "set background=dark",
  "hi clear",
  'if exists("syntax_on") | syntax reset | endif',
  'let g:colors_name = "one-dark-modern"',
  "",
  // UI
  hi("Normal", { fg, bg }),
  hi("NormalFloat", { fg, bg: ui("editorWidget.background", "#202020") }),
  hi("FloatBorder", { fg: ui("menu.border", "#454545"), bg: ui("editorWidget.background", "#202020") }),
  hi("Cursor", { fg: bg, bg: ui("editorCursor.foreground", "#528bff") }),
  hi("CursorLine", { bg: cursorLine }),
  hi("CursorColumn", { bg: cursorLine }),
  hi("ColorColumn", { bg: cursorLine }),
  hi("LineNr", { fg: ui("editorLineNumber.foreground", "#6e7681") }),
  hi("CursorLineNr", { fg: ui("editorLineNumber.activeForeground", "#cccccc") }),
  hi("SignColumn", { bg }),
  hi("Visual", { bg: visual }),
  hi("VisualNOS", { bg: visual }),
  hi("Search", { bg: search }),
  hi("IncSearch", { fg: bg, bg: num }),
  hi("CurSearch", { fg: bg, bg: num }),
  hi("MatchParen", { bg: ui("editorBracketMatch.background", "#515a6b") }),
  hi("Folded", { fg: comment, bg: cursorLine }),
  hi("FoldColumn", { fg: comment }),
  hi("NonText", { fg: ui("editorLineNumber.foreground", "#6e7681") }),
  hi("Whitespace", { fg: border }),
  hi("SpecialKey", { fg: builtin }),
  hi("VertSplit", { fg: border }),
  hi("WinSeparator", { fg: border }),
  hi("StatusLine", { fg: ui("statusBar.foreground", "#cccccc"), bg: panelBg }),
  hi("StatusLineNC", { fg: ui("tab.inactiveForeground", "#9d9d9d"), bg: panelBg }),
  hi("TabLine", { fg: ui("tab.inactiveForeground", "#9d9d9d"), bg: panelBg }),
  hi("TabLineFill", { bg: panelBg }),
  hi("TabLineSel", { fg: ui("tab.activeForeground", "#ffffff"), bg }),
  hi("Pmenu", { fg, bg: ui("editorWidget.background", "#202020") }),
  hi("PmenuSel", { fg: "#ffffff", bg: "#04395e" }),
  hi("PmenuSbar", { bg: ui("editorWidget.background", "#202020") }),
  hi("PmenuThumb", { bg: "#646464" }),
  hi("WildMenu", { fg: "#ffffff", bg: "#04395e" }),
  hi("Directory", { fg: func }),
  hi("Title", { fg: variable, style: "bold" }),
  hi("ErrorMsg", { fg: errorFg }),
  hi("WarningMsg", { fg: warnFg }),
  hi("MoreMsg", { fg: str }),
  hi("Question", { fg: func }),
  hi("Underlined", { fg: linkFg, style: "underline" }),
  "",
  // diff
  hi("DiffAdd", { bg: blend("#9ccc2c33", bg) }),
  hi("DiffChange", { bg: blend("#0078d433", bg) }),
  hi("DiffDelete", { fg: comment, bg: blend("#ff000033", bg) }),
  hi("DiffText", { bg: blend("#0078d466", bg) }),
  hi("diffAdded", { fg: str }),
  hi("diffChanged", { fg: cls }),
  hi("diffRemoved", { fg: variable }),
  hi("GitGutterAdd", { fg: ui("editorGutter.addedBackground", "#2ea043") }),
  hi("GitGutterChange", { fg: ui("editorGutter.modifiedBackground", "#0078d4") }),
  hi("GitGutterDelete", { fg: ui("editorGutter.deletedBackground", "#f85149") }),
  link("GitSignsAdd", "GitGutterAdd"),
  link("GitSignsChange", "GitGutterChange"),
  link("GitSignsDelete", "GitGutterDelete"),
  "",
  // syntax
  hi("Comment", { fg: comment, style: "italic" }),
  hi("Constant", { fg: num }),
  hi("String", { fg: str }),
  hi("Character", { fg: str }),
  hi("Number", { fg: num }),
  hi("Boolean", { fg: num }),
  hi("Float", { fg: num }),
  hi("Identifier", { fg: variable }),
  hi("Function", { fg: func }),
  hi("Statement", { fg: keyword }),
  hi("Conditional", { fg: keyword }),
  hi("Repeat", { fg: keyword }),
  hi("Label", { fg: variable }),
  hi("Operator", { fg: operator }),
  hi("Keyword", { fg: keyword }),
  hi("Exception", { fg: keyword }),
  hi("PreProc", { fg: keyword }),
  hi("Include", { fg: keyword }),
  hi("Define", { fg: keyword }),
  hi("Macro", { fg: func }),
  hi("PreCondit", { fg: keyword }),
  hi("Type", { fg: cls }),
  hi("StorageClass", { fg: keyword }),
  hi("Structure", { fg: cls }),
  hi("Typedef", { fg: cls }),
  hi("Special", { fg: builtin }),
  hi("SpecialChar", { fg: escape }),
  hi("Tag", { fg: variable }),
  hi("Delimiter", { fg }),
  hi("SpecialComment", { fg: comment, style: "italic" }),
  hi("Debug", { fg: keyword }),
  hi("Error", { fg: token("invalid.illegal", "#f44747") }),
  hi("Todo", { fg: num, style: "italic" }),
  "",
  // diagnostics (Neovim LSP)
  hi("DiagnosticError", { fg: errorFg }),
  hi("DiagnosticWarn", { fg: warnFg }),
  hi("DiagnosticInfo", { fg: "#3794ff" }),
  hi("DiagnosticHint", { fg: comment }),
  hi("DiagnosticUnderlineError", { sp: errorFg, style: "undercurl" }),
  hi("DiagnosticUnderlineWarn", { sp: warnFg, style: "undercurl" }),
  "",
  // Treesitter / semantic (Neovim only - '@' is invalid in Vim group names)
  "if has('nvim')",
  hi("@variable", { fg: variable }),
  hi("@variable.builtin", { fg: token("variable.language", "#e06c75") }),
  hi("@variable.parameter", { fg: semantic("parameter", "#e06c75"), style: "italic" }),
  hi("@variable.member", { fg: variable }),
  hi("@property", { fg: variable }),
  hi("@constant", { fg: constant }),
  hi("@constant.builtin", { fg: num }),
  hi("@module", { fg: cls }),
  hi("@type", { fg: cls }),
  hi("@type.builtin", { fg: cls }),
  hi("@constructor", { fg: cls }),
  hi("@function", { fg: func }),
  hi("@function.builtin", { fg: builtin }),
  hi("@function.method", { fg: func }),
  hi("@keyword", { fg: keyword }),
  hi("@keyword.operator", { fg: keyword }),
  hi("@operator", { fg: operator }),
  hi("@string.escape", { fg: escape }),
  hi("@string.regexp", { fg: semantic("regexp", "#56b6c2") }),
  hi("@tag", { fg: variable }),
  hi("@tag.attribute", { fg: num }),
  hi("@markup.heading", { fg: variable }),
  hi("@markup.raw", { fg: str }),
  hi("@markup.link.url", { fg: keyword, style: "underline" }),
  link("@lsp.type.class", "@type"),
  link("@lsp.type.function", "@function"),
  link("@lsp.type.method", "@function.method"),
  link("@lsp.type.parameter", "@variable.parameter"),
  link("@lsp.type.property", "@property"),
  link("@lsp.type.variable", "@variable"),
  "endif",
  "",
];

// terminal palette
const ansiKeys = [
  "Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White",
  "BrightBlack", "BrightRed", "BrightGreen", "BrightYellow", "BrightBlue",
  "BrightMagenta", "BrightCyan", "BrightWhite",
];
const ansiColors = ansiKeys.map((k) => ui(`terminal.ansi${k}`, "#000000"));
lines.push("if has('nvim')");
ansiColors.forEach((c, i) => lines.push(`  let g:terminal_color_${i} = '${c}'`));
lines.push("else");
lines.push(`  let g:terminal_ansi_colors = [${ansiColors.map((c) => `'${c}'`).join(", ")}]`);
lines.push("endif");
lines.push("");

mkdirSync(join(root, "dist/vim/colors"), { recursive: true });
writeFileSync(join(root, "dist/vim/colors/one-dark-modern.vim"), lines.join("\n"));
console.log("vim: dist/vim/colors/one-dark-modern.vim");
