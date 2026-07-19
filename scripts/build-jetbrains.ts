#!/usr/bin/env node
// Generate a JetBrains editor color scheme (.icls) from the built VS Code
// theme. Import via Settings > Editor > Color Scheme > gear > Import Scheme.
// Editor colors, console ANSI palette and VCS gutters are all scheme-side;
// only the IDE chrome (UI theme) is not covered by an .icls.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blend, loadBuiltTheme, raw, root, semanticColor, tokenColor, uiColor } from "./lib.ts";

const theme = loadBuiltTheme();

const ui = (key: string, fallback: string): string => uiColor(theme, key, fallback);
const token = (scope: string, fallback: string): string => tokenColor(theme, scope, fallback);
const semantic = (key: string, fallback: string): string => semanticColor(theme, key, fallback);

// ---- palette (all values come from the built VS Code theme) --------------
const editorBg = ui("editor.background", "#1f1f1f");
const editorFg = ui("editor.foreground", "#abb2bf");
const panelBg = ui("sideBar.background", "#181818");
const border = ui("sideBar.border", "#2b2b2b");

const keyword = token("keyword", "#c678dd");
const str = token("string", "#98c379");
const num = token("constant.numeric", "#d19a66");
const comment = semantic("comment", token("comment", "#7f848e"));
const func = semantic("function", "#61afef");
const cls = semantic("class", "#e5c07b");
const variable = semantic("variable", "#e06c75");
const constant = semantic("variable.readonly", "#e5c07b");
const parameter = semantic("parameter", "#e06c75");
const property = semantic("property", "#e06c75");
const builtin = token("support.function", "#56b6c2");
const escape = token("constant.character.escape", "#56b6c2");
const regexp = semantic("regexp", "#56b6c2");
const tag = token("entity.name.tag", "#e06c75");
const attribute = token("entity.other.attribute-name", "#d19a66");
const operator = token("keyword.operator", "#abb2bf");
const namespace = semantic("namespace", "#e5c07b");
const decorator = semantic("decorator", "#61afef");
const invalid = token("invalid.illegal", "#f44747");

const selectionBg = blend(ui("editor.selectionBackground", "#67769660"), editorBg);
const caretRow = blend(ui("editor.lineHighlightBackground", "#2c313c"), editorBg);
const searchBg = blend(ui("editor.findMatchBackground", "#d19a6644"), editorBg);
const wordHl = blend(ui("editor.wordHighlightBackground", "#d2e0ff2f"), editorBg);

// ---- .icls editor scheme -------------------------------------------------
type Attr = { fg?: string; bg?: string; font?: 1 | 2 | 3; effect?: string; effectType?: number };
const attr = (name: string, a: Attr): string => {
  const opts: string[] = [];
  if (a.fg) opts.push(`<option name="FOREGROUND" value="${raw(a.fg)}"/>`);
  if (a.bg) opts.push(`<option name="BACKGROUND" value="${raw(a.bg)}"/>`);
  if (a.font) opts.push(`<option name="FONT_TYPE" value="${a.font}"/>`);
  if (a.effect) opts.push(`<option name="EFFECT_COLOR" value="${raw(a.effect)}"/>`);
  if (a.effectType !== undefined) opts.push(`<option name="EFFECT_TYPE" value="${a.effectType}"/>`);
  return `    <option name="${name}">\n      <value>\n        ${opts.join("\n        ")}\n      </value>\n    </option>`;
};

const ansi = (k: string) => ui(`terminal.ansi${k}`, "#000000");
const colorOptions: Record<string, string> = {
  ADDED_LINES_COLOR: ui("editorGutter.addedBackground", "#2ea043"),
  ANNOTATIONS_COLOR: ui("editorLineNumber.foreground", "#6e7681"),
  CARET_COLOR: ui("editorCursor.foreground", "#528bff"),
  CARET_ROW_COLOR: caretRow,
  CONSOLE_BACKGROUND_KEY: panelBg,
  DELETED_LINES_COLOR: ui("editorGutter.deletedBackground", "#f85149"),
  DOCUMENTATION_COLOR: ui("editorWidget.background", "#202020"),
  GUTTER_BACKGROUND: editorBg,
  INDENT_GUIDE: ui("editorIndentGuide.background1", "#404040"),
  LINE_NUMBERS_COLOR: ui("editorLineNumber.foreground", "#6e7681"),
  LINE_NUMBER_ON_CARET_ROW_COLOR: ui("editorLineNumber.activeForeground", "#cccccc"),
  MODIFIED_LINES_COLOR: ui("editorGutter.modifiedBackground", "#0078d4"),
  RIGHT_MARGIN_COLOR: ui("editorIndentGuide.background1", "#404040"),
  SELECTED_INDENT_GUIDE: ui("editorIndentGuide.activeBackground1", "#707070"),
  SELECTION_BACKGROUND: selectionBg,
  SELECTION_FOREGROUND: "",
  TEARLINE_COLOR: border,
  VISUAL_INDENT_GUIDE: ui("editorIndentGuide.background1", "#404040"),
  WHITESPACES: ui("editorLineNumber.foreground", "#6e7681"),
};

const attributes: Array<[string, Attr]> = [
  ["TEXT", { fg: editorFg, bg: editorBg }],
  ["DELETED_TEXT_ATTRIBUTES", { fg: comment }],
  ["FOLDED_TEXT_ATTRIBUTES", { fg: comment, bg: caretRow }],

  // defaults (inherited by most languages)
  ["DEFAULT_KEYWORD", { fg: keyword }],
  ["DEFAULT_STRING", { fg: str }],
  ["DEFAULT_VALID_STRING_ESCAPE", { fg: escape }],
  ["DEFAULT_INVALID_STRING_ESCAPE", { fg: invalid }],
  ["DEFAULT_NUMBER", { fg: num }],
  ["DEFAULT_LINE_COMMENT", { fg: comment, font: 2 }],
  ["DEFAULT_BLOCK_COMMENT", { fg: comment, font: 2 }],
  ["DEFAULT_DOC_COMMENT", { fg: comment, font: 2 }],
  ["DEFAULT_DOC_MARKUP", { fg: str }],
  ["DEFAULT_DOC_COMMENT_TAG", { fg: attribute }],
  ["DEFAULT_FUNCTION_DECLARATION", { fg: func }],
  ["DEFAULT_FUNCTION_CALL", { fg: func }],
  ["DEFAULT_INSTANCE_METHOD", { fg: func }],
  ["DEFAULT_STATIC_METHOD", { fg: func }],
  ["DEFAULT_CLASS_NAME", { fg: cls }],
  ["DEFAULT_CLASS_REFERENCE", { fg: cls }],
  ["DEFAULT_INTERFACE_NAME", { fg: cls }],
  ["DEFAULT_METADATA", { fg: decorator }],
  ["DEFAULT_LOCAL_VARIABLE", { fg: variable }],
  ["DEFAULT_GLOBAL_VARIABLE", { fg: variable }],
  ["DEFAULT_REASSIGNED_LOCAL_VARIABLE", { fg: variable }],
  ["DEFAULT_INSTANCE_FIELD", { fg: property }],
  ["DEFAULT_STATIC_FIELD", { fg: property }],
  ["DEFAULT_CONSTANT", { fg: constant }],
  ["DEFAULT_PARAMETER", { fg: parameter, font: 2 }],
  ["DEFAULT_REASSIGNED_PARAMETER", { fg: parameter, font: 2 }],
  ["DEFAULT_IDENTIFIER", { fg: editorFg }],
  ["DEFAULT_OPERATION_SIGN", { fg: operator }],
  ["DEFAULT_BRACES", { fg: editorFg }],
  ["DEFAULT_BRACKETS", { fg: editorFg }],
  ["DEFAULT_PARENTHS", { fg: editorFg }],
  ["DEFAULT_DOT", { fg: editorFg }],
  ["DEFAULT_COMMA", { fg: editorFg }],
  ["DEFAULT_SEMICOLON", { fg: editorFg }],
  ["DEFAULT_LABEL", { fg: variable }],
  ["DEFAULT_PREDEFINED_SYMBOL", { fg: builtin }],
  ["DEFAULT_TAG", { fg: tag }],
  ["DEFAULT_ATTRIBUTE", { fg: attribute }],
  ["DEFAULT_ENTITY", { fg: attribute }],
  ["DEFAULT_TEMPLATE_LANGUAGE_COLOR", { fg: keyword }],

  // markup / web
  ["HTML_TAG_NAME", { fg: tag }],
  ["HTML_ATTRIBUTE_NAME", { fg: attribute }],
  ["HTML_ATTRIBUTE_VALUE", { fg: str }],
  ["CSS.PROPERTY_NAME", { fg: editorFg }],
  ["CSS.PROPERTY_VALUE", { fg: num }],
  ["CSS.CLASS_NAME", { fg: attribute }],
  ["CSS.HASH", { fg: func }],
  ["CSS.FUNCTION", { fg: builtin }],
  ["CSS.UNIT", { fg: num }],

  // JS / TS (WebStorm)
  ["JS.LOCAL_VARIABLE", { fg: variable }],
  ["JS.GLOBAL_VARIABLE", { fg: variable }],
  ["JS.PARAMETER", { fg: parameter, font: 2 }],
  ["JS.INSTANCE_MEMBER_FUNCTION", { fg: func }],
  ["JS.GLOBAL_FUNCTION", { fg: func }],
  ["JS.LOCAL_FUNCTION", { fg: func }],
  ["JS.MODULE_NAME", { fg: namespace }],
  ["JS.CLASS", { fg: cls }],
  ["JS.REGEXP", { fg: regexp }],
  ["JS.PRIMITIVE.TYPE", { fg: cls }],
  ["JS.TYPE_ALIAS", { fg: cls }],
  ["TS.TYPE_PARAMETER", { fg: cls }],
  ["TS.MODULE_NAME", { fg: namespace }],
  ["JavaScript:INJECTED_LANGUAGE_FRAGMENT", { fg: editorFg }],

  // Java (IDEA)
  ["ANNOTATION_NAME_ATTRIBUTES", { fg: cls }],
  ["CLASS_NAME_ATTRIBUTES", { fg: cls }],
  ["ABSTRACT_CLASS_NAME_ATTRIBUTES", { fg: cls }],
  ["ANONYMOUS_CLASS_NAME_ATTRIBUTES", { fg: cls }],
  ["INTERFACE_NAME_ATTRIBUTES", { fg: cls }],
  ["ENUM_NAME_ATTRIBUTES", { fg: cls }],
  ["TYPE_PARAMETER_NAME_ATTRIBUTES", { fg: cls }],
  ["STATIC_FINAL_FIELD_ATTRIBUTES", { fg: constant }],
  ["INSTANCE_FIELD_ATTRIBUTES", { fg: property }],
  ["STATIC_FIELD_ATTRIBUTES", { fg: property }],
  ["LOCAL_VARIABLE_ATTRIBUTES", { fg: variable }],
  ["PARAMETER_ATTRIBUTES", { fg: parameter, font: 2 }],
  ["METHOD_DECLARATION_ATTRIBUTES", { fg: func }],
  ["METHOD_CALL_ATTRIBUTES", { fg: func }],
  ["STATIC_METHOD_ATTRIBUTES", { fg: func }],
  ["CONSTRUCTOR_CALL_ATTRIBUTES", { fg: cls }],
  ["CONSTRUCTOR_DECLARATION_ATTRIBUTES", { fg: cls }],

  // Go (GoLand)
  ["GO_PACKAGE", { fg: namespace }],
  ["GO_PACKAGE_EXPORTED", { fg: namespace }],
  ["GO_PACKAGE_LOCAL", { fg: namespace }],
  ["GO_BUILTIN_TYPE_REFERENCE", { fg: cls }],
  ["GO_TYPE_REFERENCE", { fg: cls }],
  ["GO_BUILTIN_FUNCTION_CALL", { fg: func }],
  ["GO_EXPORTED_FUNCTION", { fg: func }],
  ["GO_EXPORTED_FUNCTION_CALL", { fg: func }],
  ["GO_LOCAL_FUNCTION", { fg: func }],
  ["GO_LOCAL_FUNCTION_CALL", { fg: func }],
  ["GO_METHOD_RECEIVER", { fg: parameter, font: 2 }],
  ["GO_BUILTIN_CONSTANT", { fg: num }],
  ["GO_BUILTIN_VARIABLE", { fg: cls }],
  ["GO_BUILTIN_TYPE", { fg: cls }],
  ["GO_FUNCTION_PARAMETER", { fg: parameter, font: 2 }],
  ["GO_LOCAL_VARIABLE", { fg: variable }],
  ["GO_SHADOWING_VARIABLE", { fg: variable }],
  ["GO_STRUCT_EXPORTED_MEMBER", { fg: property }],
  ["GO_STRUCT_LOCAL_MEMBER", { fg: property }],
  ["GO_LOCAL_CONSTANT", { fg: constant }],
  ["GO_PACKAGE_EXPORTED_CONSTANT", { fg: constant }],
  ["GO_PACKAGE_LOCAL_CONSTANT", { fg: constant }],
  ["GO_LABEL", { fg: variable }],

  // Python (PyCharm / Python plugin)
  ["PY.DECORATOR", { fg: decorator }],
  ["PY.CLASS_DEFINITION", { fg: cls }],
  ["PY.FUNC_DEFINITION", { fg: func }],
  ["PY.NESTED_FUNC_DEFINITION", { fg: func }],
  ["PY.PREDEFINED_DEFINITION", { fg: func }],
  ["PY.PREDEFINED_USAGE", { fg: func }],
  ["PY.BUILTIN_NAME", { fg: func }],
  ["PY.SELF_PARAMETER", { fg: token("variable.parameter.function.language.special.self.python", "#e5c07b") }],
  ["PY.KEYWORD_ARGUMENT", { fg: token("variable.parameter.function.python", "#d19a66") }],
  ["PY.ANNOTATION", { fg: cls }],
  ["PY.STRING.B", { fg: str }],

  // Shell script (Shell plugin)
  ["BASH.EXTERNAL_COMMAND", { fg: token("entity.name.command.shell", "#98c379") }],
  ["BASH.SUBSHELL_COMMAND", { fg: token("entity.name.command.shell", "#98c379") }],
  ["BASH.FUNCTION_DEF_NAME", { fg: func }],

  // console (terminal palette)
  ["CONSOLE_NORMAL_OUTPUT", { fg: ui("terminal.foreground", "#abb2bf") }],
  ["CONSOLE_ERROR_OUTPUT", { fg: ansi("Red") }],
  ["CONSOLE_USER_INPUT", { fg: str }],
  ["CONSOLE_SYSTEM_OUTPUT", { fg: ui("terminal.foreground", "#abb2bf") }],
  ["CONSOLE_BLACK_OUTPUT", { fg: ansi("Black") }],
  ["CONSOLE_RED_OUTPUT", { fg: ansi("Red") }],
  ["CONSOLE_GREEN_OUTPUT", { fg: ansi("Green") }],
  ["CONSOLE_YELLOW_OUTPUT", { fg: ansi("Yellow") }],
  ["CONSOLE_BLUE_OUTPUT", { fg: ansi("Blue") }],
  ["CONSOLE_MAGENTA_OUTPUT", { fg: ansi("Magenta") }],
  ["CONSOLE_CYAN_OUTPUT", { fg: ansi("Cyan") }],
  ["CONSOLE_GRAY_OUTPUT", { fg: ansi("White") }],
  ["CONSOLE_DARKGRAY_OUTPUT", { fg: ansi("BrightBlack") }],
  ["CONSOLE_RED_BRIGHT_OUTPUT", { fg: ansi("BrightRed") }],
  ["CONSOLE_GREEN_BRIGHT_OUTPUT", { fg: ansi("BrightGreen") }],
  ["CONSOLE_YELLOW_BRIGHT_OUTPUT", { fg: ansi("BrightYellow") }],
  ["CONSOLE_BLUE_BRIGHT_OUTPUT", { fg: ansi("BrightBlue") }],
  ["CONSOLE_MAGENTA_BRIGHT_OUTPUT", { fg: ansi("BrightMagenta") }],
  ["CONSOLE_CYAN_BRIGHT_OUTPUT", { fg: ansi("BrightCyan") }],
  ["CONSOLE_WHITE_OUTPUT", { fg: ansi("BrightWhite") }],

  // editor highlights
  ["IDENTIFIER_UNDER_CARET_ATTRIBUTES", { bg: wordHl }],
  ["WRITE_IDENTIFIER_UNDER_CARET_ATTRIBUTES", { bg: blend(ui("editor.wordHighlightStrongBackground", "#abb2bf26"), editorBg) }],
  ["SEARCH_RESULT_ATTRIBUTES", { bg: searchBg }],
  ["TEXT_SEARCH_RESULT_ATTRIBUTES", { bg: searchBg }],
  ["WRONG_REFERENCES_ATTRIBUTES", { fg: ui("errorForeground", "#f85149") }],
  ["ERRORS_ATTRIBUTES", { effect: ui("editorError.foreground", "#f85149"), effectType: 2 }],
  ["WARNING_ATTRIBUTES", { effect: "#cca700", effectType: 2 }],
  ["TODO_DEFAULT_ATTRIBUTES", { fg: attribute, font: 2 }],
  ["HYPERLINK_ATTRIBUTES", { fg: ui("textLink.foreground", "#4daafc"), effect: ui("textLink.foreground", "#4daafc"), effectType: 1 }],

  // markdown
  ["MARKDOWN_HEADER_LEVEL_1", { fg: tag, font: 1 }],
  ["MARKDOWN_HEADER_LEVEL_2", { fg: tag, font: 1 }],
  ["MARKDOWN_HEADER_LEVEL_3", { fg: tag, font: 1 }],
  ["MARKDOWN_HEADER_LEVEL_4", { fg: tag, font: 1 }],
  ["MARKDOWN_HEADER_LEVEL_5", { fg: tag, font: 1 }],
  ["MARKDOWN_HEADER_LEVEL_6", { fg: tag, font: 1 }],
  ["MARKDOWN_CODE_SPAN", { fg: str }],
  ["MARKDOWN_LINK_DESTINATION", { fg: builtin }],
];

const icls = `<scheme name="One Dark Modern" version="142" parent_scheme="Darcula">
  <metaInfo>
    <property name="generated">true</property>
    <property name="ide">idea</property>
  </metaInfo>
  <colors>
${Object.entries(colorOptions)
  .map(([k, v]) => `    <option name="${k}" value="${raw(v)}"/>`)
  .join("\n")}
  </colors>
  <attributes>
${attributes.map(([k, a]) => attr(k, a)).join("\n")}
  </attributes>
</scheme>
`;

// ---- write ---------------------------------------------------------------
const out = join(root, "dist/jetbrains");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "OneDarkModern.icls"), icls);
console.log(
  `jetbrains: ${Object.keys(colorOptions).length} scheme colors, ${attributes.length} attributes -> dist/jetbrains/OneDarkModern.icls`
);
