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

// Walk a string of JSONC source, invoking `onChar` for every character that
// lies *outside* a string literal, and `onString` once per string literal
// (verbatim, quotes included). Centralizes the "don't touch string
// contents" logic so jsonc() doesn't need two ad-hoc copies of it (one for
// comment-stripping, one for trailing-comma removal).
const scanOutsideStrings = (
  s: string,
  onString: (lit: string) => void,
  onChar: (c: string, i: number) => number | void
): void => {
  const n = s.length;
  let i = 0;
  while (i < n) {
    const c = s[i];
    if (c === '"') {
      let j = i + 1;
      while (j < n) {
        if (s[j] === "\\") {
          j += 2;
          continue;
        }
        if (s[j] === '"') {
          j++;
          break;
        }
        j++;
      }
      onString(s.slice(i, j));
      i = j;
      continue;
    }
    const advance = onChar(c, i);
    i = typeof advance === "number" ? advance : i + 1;
  }
};

// strip `//` and `/* */` comments, string-literal-aware: a `//` or `/*`
// that appears inside a "..." string is left untouched.
const stripComments = (s: string): string => {
  let out = "";
  const n = s.length;
  scanOutsideStrings(
    s,
    (lit) => {
      out += lit;
    },
    (c, i) => {
      if (c === "/" && s[i + 1] === "/") {
        let j = i + 2;
        while (j < n && s[j] !== "\n") j++;
        return j;
      }
      if (c === "/" && s[i + 1] === "*") {
        let j = i + 2;
        while (j < n && !(s[j] === "*" && s[j + 1] === "/")) j++;
        return j + 2;
      }
      out += c;
    }
  );
  return out;
};

// drop a trailing comma before `}` or `]`, string-literal-aware.
const stripTrailingCommas = (s: string): string => {
  let out = "";
  const n = s.length;
  scanOutsideStrings(
    s,
    (lit) => {
      out += lit;
    },
    (c, i) => {
      if (c === ",") {
        let j = i + 1;
        while (j < n && /\s/.test(s[j])) j++;
        if (s[j] === "}" || s[j] === "]") return i + 1; // drop the comma itself
      }
      out += c;
    }
  );
  return out;
};

// JSONC (comments, trailing commas) — upstream theme files use it.
// String-literal-aware: a `//`, `/*`, or dangling `,` that appears inside a
// JSON string value is left alone rather than being treated as syntax.
export const jsonc = <T>(s: string): T =>
  JSON.parse(stripTrailingCommas(stripComments(s))) as T;

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

// keys where uiColor() actually fell back to its hardcoded default because
// the built theme didn't define them — populated as builders run, drained
// (and reported) by warnFallbacksUsed().
const fallbacksUsed = new Set<string>();

export const uiColor = (theme: Theme, key: string, fallback: string): string => {
  if (theme.colors[key] === undefined) fallbacksUsed.add(key);
  return theme.colors[key] ?? fallback;
};

// Print one summary warning line (not per-key spam) listing every UI color
// key that fell back to its hardcoded default this run, then clear the set.
// Warning only - never throws, never affects exit code. Call once near the
// end of a builder script, after all uiColor() calls have happened.
export const warnFallbacksUsed = (label = ""): void => {
  if (fallbacksUsed.size === 0) return;
  const prefix = label ? `${label}: ` : "";
  console.warn(
    `${prefix}warning: ${fallbacksUsed.size} UI color fallback(s) used (key missing from built theme): ` +
      [...fallbacksUsed].sort().join(", ")
  );
  fallbacksUsed.clear();
};

// exposed for tests only - lets a test assert on fallback tracking without
// depending on console output.
export const _fallbacksUsedForTest = fallbacksUsed;

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

// value-level recolor: replace the RGB part of any color that matches one
// of `map`'s keys, keeping any alpha suffix. Used to remap an upstream
// accent color to ours across a whole `colors` object.
export const recolor = (
  colors: Record<string, string>,
  map: Record<string, string>
): Record<string, string> => {
  const rules = Object.entries(map).map(([from, to]) => ({
    from: from.toLowerCase(),
    to: to.toLowerCase(),
  }));
  for (const { from } of rules) {
    if (!/^#[0-9a-f]{6}$/.test(from)) {
      throw new Error(`recolor: map key must be a full #rrggbb color, got "${from}"`);
    }
  }
  return Object.fromEntries(
    Object.entries(colors).map(([k, v]) => {
      const lower = v.toLowerCase();
      for (const { from, to } of rules) {
        // match the RGB part exactly - either the whole value, or #rrggbb
        // followed by a 2-digit alpha (never a longer/other-length value)
        const rest = lower.slice(from.length);
        if (lower.slice(0, from.length) === from && /^(|[0-9a-f]{2})$/.test(rest)) {
          return [k, to + rest];
        }
      }
      return [k, v];
    })
  );
};

// ---- runtime shape validation (docs/IMPROVEMENT-IDEAS.md #33) ------------
// No schema library: plain checks with clear, path-carrying error messages,
// used by build.ts on every file it reads from syntax/ and overrides/.

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// object of string -> string, e.g. overrides/colors.json, syntax/families.json
export const validateColorMap = (label: string, v: unknown): Record<string, string> => {
  if (!isPlainObject(v)) {
    throw new Error(`${label}: expected an object, got ${v === null ? "null" : typeof v}`);
  }
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== "string") {
      throw new Error(`${label}.${JSON.stringify(k)}: expected a string value, got ${typeof val}`);
    }
  }
  return v as Record<string, string>;
};

export interface SyntaxRuleShape {
  family: string;
  scope: string[];
  settings?: Record<string, string>;
}

// syntax/tokens.json: array of { family: known family (or "style-only"),
// scope: non-empty string[], settings?: string->string }
export const validateSyntaxRules = (
  v: unknown,
  knownFamilies: Record<string, string>
): SyntaxRuleShape[] => {
  if (!Array.isArray(v)) {
    throw new Error(`syntax/tokens.json: expected an array, got ${typeof v}`);
  }
  v.forEach((rule, i) => {
    const where = `syntax/tokens.json[${i}]`;
    if (!isPlainObject(rule)) throw new Error(`${where}: expected an object`);
    if (typeof rule.family !== "string") {
      throw new Error(`${where}.family: expected a string, got ${typeof rule.family}`);
    }
    if (rule.family !== "style-only" && !(rule.family in knownFamilies)) {
      throw new Error(`${where}: unknown family "${rule.family}" (not in syntax/families.json)`);
    }
    if (
      !Array.isArray(rule.scope) ||
      rule.scope.length === 0 ||
      !rule.scope.every((s: unknown) => typeof s === "string")
    ) {
      throw new Error(`${where} (family "${rule.family}"): scope must be a non-empty array of strings`);
    }
    if (rule.settings !== undefined) {
      if (
        !isPlainObject(rule.settings) ||
        !Object.values(rule.settings).every((s) => typeof s === "string")
      ) {
        throw new Error(`${where} (family "${rule.family}"): settings must be an object of string values`);
      }
    }
  });
  return v as SyntaxRuleShape[];
};

export interface SemanticEntryShape {
  family: string;
  italic?: boolean;
}

// syntax/semantic.json: object of key -> { family: known family, italic?: boolean }
export const validateSemanticSource = (
  v: unknown,
  knownFamilies: Record<string, string>
): Record<string, SemanticEntryShape> => {
  if (!isPlainObject(v)) {
    throw new Error(`syntax/semantic.json: expected an object, got ${v === null ? "null" : typeof v}`);
  }
  for (const [key, entry] of Object.entries(v)) {
    const where = `syntax/semantic.json.${key}`;
    if (!isPlainObject(entry)) throw new Error(`${where}: expected an object`);
    if (typeof entry.family !== "string") {
      throw new Error(`${where}.family: expected a string, got ${typeof entry.family}`);
    }
    if (!(entry.family in knownFamilies)) {
      throw new Error(`${where}: unknown family "${entry.family}" (not in syntax/families.json)`);
    }
    if (entry.italic !== undefined && typeof entry.italic !== "boolean") {
      throw new Error(`${where}.italic: expected a boolean, got ${typeof entry.italic}`);
    }
  }
  return v as Record<string, SemanticEntryShape>;
};
