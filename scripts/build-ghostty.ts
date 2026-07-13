#!/usr/bin/env node
// Generate a Ghostty terminal theme from the built VS Code theme.
// Emits dist/ghostty/one-dark-modern. Install by copying it to
// ~/.config/ghostty/themes/ and setting `theme = one-dark-modern`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const theme = JSON.parse(
  readFileSync(join(root, "themes/one-dark-modern-color-theme.json"), "utf8")
) as { colors: Record<string, string> };
const ui = (key: string, fallback: string): string => theme.colors[key] ?? fallback;

const blend = (color: string, base: string): string => {
  const c = color.replace("#", "");
  if (c.length !== 8) return "#" + c;
  const a = parseInt(c.slice(6, 8), 16) / 255;
  const mix = (i: number) =>
    Math.round(
      parseInt(c.slice(i, i + 2), 16) * a +
        parseInt(base.replace("#", "").slice(i, i + 2), 16) * (1 - a)
    )
      .toString(16)
      .padStart(2, "0");
  return "#" + mix(0) + mix(2) + mix(4);
};

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
