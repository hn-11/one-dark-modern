#!/usr/bin/env node
// Minimal sanity checks for the non-VS-Code artifacts in dist/
// (docs/IMPROVEMENT-IDEAS.md item 27). These three files are generated
// once and then never opened by anything in CI; a builder regression -
// a dropped palette slot, an empty color, a stray quote - would ship
// silently. This is not a color audit (that is audit-contrast.ts); it
// only asks "is the file structurally what the target program expects".
//
// Run `npm run build` first: the checks read dist/, not the sources.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./lib.ts";

const problems: string[] = [];
const fail = (file: string, msg: string): void => {
  problems.push(`${file}: ${msg}`);
};
const HEX = /^#[0-9a-fA-F]{6}$/;

const readDist = (rel: string): string | null => {
  const p = join(root, rel);
  if (!existsSync(p)) {
    fail(rel, "missing - run `npm run build`");
    return null;
  }
  return readFileSync(p, "utf8");
};

// ---- ghostty: `key = value` lines, 16 palette slots + background/foreground
const GHOSTTY = "dist/ghostty/one-dark-modern";
const ghostty = readDist(GHOSTTY);
if (ghostty !== null) {
  const palette = new Map<number, string>();
  const settings = new Map<string, string>();
  for (const raw of ghostty.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) {
      fail(GHOSTTY, `not a \`key = value\` line: ${JSON.stringify(line)}`);
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === "palette") {
      const m = /^(\d+)\s*=\s*(.*)$/.exec(value);
      if (!m) {
        fail(GHOSTTY, `malformed palette entry: ${JSON.stringify(line)}`);
        continue;
      }
      const slot = Number(m[1]);
      if (palette.has(slot)) fail(GHOSTTY, `palette slot ${slot} defined twice`);
      palette.set(slot, m[2].trim());
    } else {
      settings.set(key, value);
    }
  }
  for (let i = 0; i < 16; i++) {
    const v = palette.get(i);
    if (v === undefined) fail(GHOSTTY, `palette slot ${i} not defined`);
    else if (!HEX.test(v)) fail(GHOSTTY, `palette slot ${i} is not #rrggbb: ${JSON.stringify(v)}`);
  }
  for (const key of ["background", "foreground"]) {
    const v = settings.get(key);
    if (v === undefined) fail(GHOSTTY, `no \`${key}\` setting`);
    else if (!HEX.test(v)) fail(GHOSTTY, `${key} is not #rrggbb: ${JSON.stringify(v)}`);
  }
}

// ---- windows terminal: JSON, 16 named color keys + background/foreground
const WT = "dist/windows-terminal/one-dark-modern.json";
const wt = readDist(WT);
if (wt !== null) {
  let scheme: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(wt);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      fail(WT, "top level is not a JSON object");
    } else {
      scheme = parsed as Record<string, unknown>;
    }
  } catch (e) {
    fail(WT, `does not parse as JSON: ${(e as Error).message}`);
  }
  if (scheme) {
    // the 16 slot names Windows Terminal itself requires in a color scheme
    const SLOTS = [
      "black", "red", "green", "yellow", "blue", "purple", "cyan", "white",
      "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue",
      "brightPurple", "brightCyan", "brightWhite",
    ];
    for (const key of [...SLOTS, "background", "foreground", "name"]) {
      const v = scheme[key];
      if (v === undefined) fail(WT, `missing key "${key}"`);
      else if (typeof v !== "string") fail(WT, `"${key}" is not a string`);
      else if (key !== "name" && !HEX.test(v)) fail(WT, `"${key}" is not #rrggbb: ${JSON.stringify(v)}`);
    }
  }
}

// ---- vim: every `hi` line well formed; and if a vim binary exists, load it
const VIM = "dist/vim/colors/one-dark-modern.vim";
const vim = readDist(VIM);
if (vim !== null) {
  let hiLines = 0;
  vim.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    const at = `line ${i + 1}`;
    if (line.startsWith("hi! link ")) {
      const parts = line.split(/\s+/);
      if (parts.length !== 4 || parts[2] === "" || parts[3] === "") {
        fail(VIM, `${at}: malformed link: ${JSON.stringify(line)}`);
      }
      return;
    }
    if (!/^hi\b/.test(line)) return;
    if (line === "hi clear") return;
    hiLines++;
    const parts = line.split(/\s+/);
    if (parts.length < 3) {
      fail(VIM, `${at}: \`hi\` with no attributes: ${JSON.stringify(line)}`);
      return;
    }
    for (const attr of parts.slice(2)) {
      const eq = attr.indexOf("=");
      if (eq < 0) {
        fail(VIM, `${at}: attribute without \`=\`: ${JSON.stringify(attr)}`);
        continue;
      }
      const key = attr.slice(0, eq);
      const value = attr.slice(eq + 1);
      if (value === "") {
        fail(VIM, `${at}: empty value for ${key}`);
        continue;
      }
      if (/^gui(fg|bg|sp)$/.test(key) && value !== "NONE" && !HEX.test(value)) {
        fail(VIM, `${at}: ${key} is neither NONE nor #rrggbb: ${JSON.stringify(value)}`);
      }
    }
  });
  if (hiLines === 0) fail(VIM, "no highlight groups defined at all");

  // The real check when a vim is available: source the file and let vim
  // itself report errors. Absent a binary the syntax checks above stand in.
  let vimBin = "";
  try {
    vimBin = execFileSync("sh", ["-c", "command -v vim || command -v nvim || true"], {
      encoding: "utf8",
    }).trim();
  } catch {
    vimBin = "";
  }
  if (vimBin === "") {
    console.log("vim/nvim not found - syntax checks only (no load test)");
  } else {
    // vim insists on a writable home/state dir; give it a throwaway one so
    // the check never touches the runner's real config.
    const dir = mkdtempSync(join(tmpdir(), "odm-vim-"));
    try {
      execFileSync(
        vimBin,
        [
          "-N", "-u", "NONE", "-i", "NONE", "-e", "-s",
          "--cmd", "set nomore",
          "-c", `source ${join(root, VIM)}`,
          "-c", "qa!",
        ],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 30_000,
          env: { ...process.env, HOME: dir, XDG_CONFIG_HOME: dir, XDG_DATA_HOME: dir },
        }
      );
      console.log(`vim load test passed (${vimBin})`);
    } catch (e) {
      const err = e as { stderr?: string; stdout?: string; message: string };
      fail(VIM, `vim failed to source it: ${(err.stderr || err.stdout || err.message).trim()}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

for (const p of problems) console.log(`ARTIFACT ${p}`);
console.log(`artifact guard: 3 artifacts checked, ${problems.length} problem(s)`);
process.exit(problems.length > 0 ? 1 : 0);
