#!/usr/bin/env node
// Accent-family guard for One Dark 2026.
//
// Upstream 2026 Dark styles its accent as a family of teal hues; we remap
// them all to One Dark blue via overrides/accent-2026.json. When upstream
// adds a NEW teal, it would silently ship un-remapped - this scan fails CI
// instead. Any color in the built One Dark 2026 theme whose hue falls in
// the teal band and is not explicitly allowed (audit/accent-allow.json,
// with reasons) is reported.
//
// On failure: add a mapping to overrides/accent-2026.json (derive the
// replacement by channel-ratio scaling from #528BFF), or - if the color is
// legitimately teal, like One Dark's cyan - allow it with a reason.
import { readJson } from "./lib.ts";

interface ThemeFile {
  colors: Record<string, string>;
}
interface AllowEntry {
  color: string;
  reason: string;
}

const TEAL_HUE_MIN = 185;
const TEAL_HUE_MAX = 215;
const MIN_CHROMA = 30; // ignore near-grays

const theme = readJson<ThemeFile>("themes/one-dark-2026-color-theme.json");
const allow = readJson<AllowEntry[]>("audit/accent-allow.json");
const allowed = new Set(allow.map((a) => a.color.toLowerCase()));

const hueOf = (hex: string): { h: number; chroma: number } | null => {
  const c = hex.replace("#", "");
  if (c.length < 6) return null;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (d === 0) return null;
  let h: number;
  if (mx === r) h = 60 * (((g - b) / d + 6) % 6);
  else if (mx === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return { h, chroma: d };
};

const offenders = new Map<string, string[]>();
for (const [key, value] of Object.entries(theme.colors)) {
  const rgb = value.slice(0, 7).toLowerCase();
  if (allowed.has(rgb)) continue;
  const hu = hueOf(rgb);
  if (!hu || hu.chroma < MIN_CHROMA) continue;
  if (hu.h >= TEAL_HUE_MIN && hu.h <= TEAL_HUE_MAX) {
    const keys = offenders.get(rgb) ?? [];
    keys.push(key);
    offenders.set(rgb, keys);
  }
}

for (const [color, keys] of offenders) {
  console.log(`UNMAPPED TEAL ${color} used by: ${keys.join(", ")}`);
}
console.log(
  `accent guard: ${Object.keys(theme.colors).length} colors scanned, ` +
    `${allowed.size} allowed, ${offenders.size} unmapped teal hue(s)`
);
process.exit(offenders.size > 0 ? 1 : 0);
