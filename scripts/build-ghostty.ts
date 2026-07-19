#!/usr/bin/env node
// Generate a Ghostty terminal theme from the built VS Code theme.
// Emits dist/ghostty/one-dark-modern. Install by copying it to
// ~/.config/ghostty/themes/ and setting `theme = one-dark-modern`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blend, loadBuiltTheme, root, uiColor } from "./lib.ts";

const theme = loadBuiltTheme();
const ui = (key: string, fallback: string): string => uiColor(theme, key, fallback);

const background = ui("panel.background", "#181818");
const ansi = [
  "Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White",
  "BrightBlack", "BrightRed", "BrightGreen", "BrightYellow", "BrightBlue",
  "BrightMagenta", "BrightCyan", "BrightWhite",
].map((k, i) => `palette = ${i}=${ui(`terminal.ansi${k}`, "#000000")}`);

const out = [
  ...ansi,
  `background = ${background}`,
  `foreground = ${ui("terminal.foreground", "#abb2bf")}`,
  `cursor-color = ${ui("editorCursor.foreground", "#528bff")}`,
  `cursor-text = ${background}`,
  `selection-background = ${blend(ui("terminal.selectionBackground", "#abb2bf30"), background)}`,
  `selection-foreground = ${ui("terminal.foreground", "#abb2bf")}`,
  "",
].join("\n");

mkdirSync(join(root, "dist/ghostty"), { recursive: true });
writeFileSync(join(root, "dist/ghostty/one-dark-modern"), out);
console.log("ghostty: dist/ghostty/one-dark-modern");
