// Shared helpers for the build/audit scripts.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export interface TokenRule {
  name?: string;
  scope: string | string[];
  settings: { foreground?: string; background?: string; fontStyle?: string };
}
export interface Theme {
  name?: string;
  colors: Record<string, string>;
  tokenColors: TokenRule[];
  semanticTokenColors?: Record<string, string | { foreground?: string; italic?: boolean }>;
}

// JSONC (comments, trailing commas) — upstream theme files use it
export const jsonc = <T>(s: string): T =>
  JSON.parse(
    s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,(\s*[}\]])/g, "$1")
  ) as T;

export const readJson = <T>(p: string): T => jsonc<T>(readFileSync(join(root, p), "utf8"));

export const loadBuiltTheme = (): Theme => readJson<Theme>("themes/one-dark-2026-color-theme.json");

// the color vocabulary (docs/PHILOSOPHY.md section 2): second-generation
// builders take syntax palette colors from here by family name; UI colors
// still come from the built theme (merged, shipped values)
export const loadFamilies = (): Record<string, string> =>
  readJson<Record<string, string>>("syntax/families.json");
export const familyColor = (families: Record<string, string>, name: string): string => {
  const c = families[name];
  if (!c) throw new Error(`unknown family: ${name}`);
  return c;
};

export const uiColor = (theme: Theme, key: string, fallback: string): string =>
  theme.colors[key] ?? fallback;


// the 16 ANSI slots, in palette order, as they are spelled in the
// `terminal.ansi*` VS Code color keys (shared by the terminal-side builders)
export const ANSI_NAMES = [
  "Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White",
  "BrightBlack", "BrightRed", "BrightGreen", "BrightYellow", "BrightBlue",
  "BrightMagenta", "BrightCyan", "BrightWhite",
] as const;

// blend #rrggbbaa over an opaque base; passthrough for #rrggbb
export const blend = (color: string, base: string): string => {
  if (!/^#?[0-9a-fA-F]{6}$/.test(base)) {
    throw new Error(`blend: base must be an opaque #rrggbb color, got "${base}"`);
  }
  const c = color.replace("#", "");
  if (c.length !== 6 && c.length !== 8) {
    throw new Error(`blend: color must be #rrggbb or #rrggbbaa, got "${color}"`);
  }
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

// .icls hex: exactly 6 digits, no "#", no alpha. Any alpha still present at
// this point is dropped (opaque approximation) rather than emitted as an
// invalid 8-digit value; call blend() first where the alpha matters visually.
export const raw = (hex: string): string => {
  const c = hex.replace("#", "").toLowerCase();
  if (c === "") return c; // deliberate "unset" (e.g. SELECTION_FOREGROUND)
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(c)) {
    throw new Error(`raw: expected #rrggbb or #rrggbbaa, got "${hex}"`);
  }
  return c.slice(0, 6);
};
