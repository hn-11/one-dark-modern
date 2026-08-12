#!/usr/bin/env node
// WCAG contrast guard for the syntax palette and the ANSI terminal palette.
//
// Every family color in syntax/families.json is measured against the
// editor background of *both* built themes, and every `terminal.ansi*`
// slot against the terminal background (which falls back to the editor
// background when a theme does not override it, exactly as VS Code does).
// Anything below 4.5:1 (WCAG AA for body text) fails unless it is listed
// in audit/contrast-allow.json with a reason.
//
// The allow file is not an escape hatch: each entry records a `floor`,
// the lowest ratio that entry is known to produce today. Drop below the
// floor and the audit fails anyway - so an inherited dim color may stay
// dim, but it may not get dimmer by accident.
//
// On failure: raise the color, or - if the dimness is the point
// (docs/PHILOSOPHY.md: an inherited color's authority is its provenance)
// - add an allow entry saying so in plain words.
import { readJson, loadFamilies, ANSI_NAMES, type Theme } from "./lib.ts";

interface AllowEntry {
  subject: string; // "family/comment-dim" or "ansi/terminal.ansiBlack"
  floor: number; // lowest ratio this subject is allowed to produce
  reason: string;
}

const AA_TEXT = 4.5;

const THEMES = [
  { name: "One Dark Modern", file: "themes/one-dark-modern-color-theme.json" },
  { name: "One Dark 2026", file: "themes/one-dark-2026-color-theme.json" },
] as const;

// WCAG 2.x relative luminance / contrast ratio.
const luminance = (hex: string): number => {
  const c = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}/.test(c)) throw new Error(`contrast: bad color "${hex}"`);
  const chan = (i: number): number => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
};
const ratio = (fg: string, bg: string): number => {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const families = loadFamilies();
const allow = readJson<AllowEntry[]>("audit/contrast-allow.json");
const allowed = new Map(allow.map((a) => [a.subject, a]));

interface Measurement {
  subject: string;
  theme: string;
  fg: string;
  bg: string;
  ratio: number;
}

const measurements: Measurement[] = [];
for (const t of THEMES) {
  const theme = readJson<Theme>(t.file);
  const editorBg = theme.colors["editor.background"];
  if (!editorBg) throw new Error(`${t.file}: no editor.background`);
  // VS Code falls back to the editor background when a theme leaves
  // terminal.background unset (One Dark Modern does).
  const termBg = theme.colors["terminal.background"] ?? editorBg;

  for (const [name, color] of Object.entries(families)) {
    measurements.push({
      subject: `family/${name}`,
      theme: t.name,
      fg: color,
      bg: editorBg,
      ratio: ratio(color, editorBg),
    });
  }
  for (const slot of ANSI_NAMES) {
    const key = `terminal.ansi${slot}`;
    const color = theme.colors[key];
    if (!color) {
      console.log(`MISSING ${key} in ${t.name}`);
      measurements.push({ subject: `ansi/${key}`, theme: t.name, fg: "#000000", bg: termBg, ratio: 0 });
      continue;
    }
    measurements.push({
      subject: `ansi/${key}`,
      theme: t.name,
      fg: color,
      bg: termBg,
      ratio: ratio(color, termBg),
    });
  }
}

const failures: string[] = [];
const usedAllow = new Set<string>();

for (const m of measurements) {
  const a = allowed.get(m.subject);
  const r = m.ratio.toFixed(2);
  if (m.ratio >= AA_TEXT) {
    if (a) usedAllow.add(m.subject); // still listed; fine, just no longer needed here
    continue;
  }
  if (!a) {
    failures.push(`LOW CONTRAST ${m.subject} ${m.fg} on ${m.bg} (${m.theme}): ${r} < ${AA_TEXT}`);
    continue;
  }
  usedAllow.add(m.subject);
  if (m.ratio < a.floor) {
    failures.push(
      `REGRESSION ${m.subject} ${m.fg} on ${m.bg} (${m.theme}): ${r} < recorded floor ${a.floor}`
    );
  }
}

// An allow entry nobody needs is stale documentation - say so, but do not
// fail on it (the same color can pass in one theme and be exempt in the
// other, and only the audit output shows which).
for (const a of allow) {
  if (!usedAllow.has(a.subject)) console.log(`STALE ALLOW ${a.subject} - no measurement matched`);
}

for (const f of failures) console.log(f);
console.log(
  `contrast guard: ${measurements.length} measurements across ${THEMES.length} themes, ` +
    `${allow.length} allowed, ${failures.length} failure(s)`
);
process.exit(failures.length > 0 ? 1 : 0);
