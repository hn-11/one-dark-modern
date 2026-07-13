#!/usr/bin/env node
// Generate a Windows Terminal color scheme from the built VS Code theme.
// Emits dist/windows-terminal/one-dark-modern.json. Paste the object into
// the "schemes" array of Windows Terminal settings.json (or drop the file
// into a fragment), then set "colorScheme": "One Dark Modern".
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
const ansi = (k: string) => ui(`terminal.ansi${k}`, "#000000");

const scheme = {
  name: "One Dark Modern",
  background,
  foreground: ui("terminal.foreground", "#abb2bf"),
  cursorColor: ui("editorCursor.foreground", "#528bff"),
  selectionBackground: blend(ui("terminal.selectionBackground", "#abb2bf30"), background),
  black: ansi("Black"),
  red: ansi("Red"),
  green: ansi("Green"),
  yellow: ansi("Yellow"),
  blue: ansi("Blue"),
  purple: ansi("Magenta"),
  cyan: ansi("Cyan"),
  white: ansi("White"),
  brightBlack: ansi("BrightBlack"),
  brightRed: ansi("BrightRed"),
  brightGreen: ansi("BrightGreen"),
  brightYellow: ansi("BrightYellow"),
  brightBlue: ansi("BrightBlue"),
  brightPurple: ansi("BrightMagenta"),
  brightCyan: ansi("BrightCyan"),
  brightWhite: ansi("BrightWhite"),
};

mkdirSync(join(root, "dist/windows-terminal"), { recursive: true });
writeFileSync(
  join(root, "dist/windows-terminal/one-dark-modern.json"),
  JSON.stringify(scheme, null, 2) + "\n"
);
console.log("windows-terminal: dist/windows-terminal/one-dark-modern.json");
