#!/usr/bin/env node
// Resolve the headless IDE highlight dumps (jetbrains-audit/build/dumps/*.json)
// against our generated .icls and check expectations.
//
// The dump carries, per token, the TextAttributesKey fallback chain straight
// from the IDE (e.g. GO_METHOD_RECEIVER -> DEFAULT_PARAMETER). We resolve the
// first key in the chain that our scheme defines - exactly what the IDE's
// scheme inheritance does - so the resulting color is what a user would see.
//
// Matching is strict and positional: a token is identified by (file, line,
// n-th occurrence of the text on that line), and the color compared is the
// single FINAL visible one - "last write wins per range start", so a daemon /
// annotator token overrides the lexer token at the same start offset, exactly
// as the editor paints it. Tokens whose whole key chain is unknown to our
// scheme do not override (they contribute nothing to the painted color).
//
// Expectations live in audit/jetbrains-expected.json:
//   { ide, file, text, line?, occurrence?, family|color, note? }
// `file` is the fixture-relative path ("go/base/main.go"), matching the `file`
// field the dump carries - basenames collide (two fixtures named test.go).
// `line` is 1-based; `occurrence` is 1-based within that line (default 1), or
// within the whole file when `line` is omitted.
// Run after: cd jetbrains-audit && gradle test -PideType=GO|WS|IC|PC
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readJson, root } from "./lib.ts";

interface DumpToken {
  layer: string;
  start: number;
  end: number;
  line?: number; // 1-based; added alongside the strict matcher
  col?: number;
  text: string;
  keys: string[][]; // each entry: key + fallback chain
}
interface Dump {
  file: string;
  tokens: DumpToken[];
}
interface Expectation {
  ide: string;
  file: string; // fixture-relative path, e.g. "go/base/main.go"
  text: string;
  line?: number; // 1-based line the token sits on
  occurrence?: number; // 1-based, among same-text tokens (on `line` if given)
  family?: string; // vocabulary family, resolved via syntax/families.json
  color?: string; // raw hex, only for colors outside the vocabulary
  note?: string;
}

const ide = process.argv[2] ?? "GO";

// key -> foreground from our .icls
const icls = readFileSync(join(root, "dist/jetbrains/OneDarkModern.icls"), "utf8");
const schemeColor = new Map<string, string>();
for (const m of icls.matchAll(
  /<option name="([^"]+)">\s*<value>([\s\S]*?)<\/value>/g
)) {
  const fg = /<option name="FOREGROUND" value="([0-9a-fA-F]+)"\/>/.exec(m[2]);
  if (fg) schemeColor.set(m[1], "#" + fg[1].toLowerCase());
}
const defaultFg = schemeColor.get("TEXT") ?? "#abb2bf";

const resolve = (chain: string[]): { key: string; color: string } => {
  for (const k of chain) {
    const c = schemeColor.get(k);
    if (c) return { key: k, color: c };
  }
  return { key: "TEXT", color: defaultFg };
};

const dumpDir = join(root, "jetbrains-audit/build/dumps", ide);
if (!existsSync(dumpDir)) {
  console.error(`no dumps at ${dumpDir} - run the gradle test first`);
  process.exit(2);
}
const dumps: Dump[] = readdirSync(dumpDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dumpDir, f), "utf8")));

const families = readJson<Record<string, string>>("syntax/families.json");
const expectations = readJson<Expectation[]>("audit/jetbrains-expected.json").filter(
  (e) => e.ide === ide
);
const expectedColor = (e: Expectation): string => {
  if (e.family) {
    const c = families[e.family];
    if (!c) throw new Error(`expectation "${e.text}": unknown family ${e.family}`);
    return c.toLowerCase();
  }
  if (!e.color) throw new Error(`expectation "${e.text}": needs family or color`);
  return e.color.toLowerCase();
};

let failures = 0;
let checked = 0;
const unresolvedKeys = new Map<string, number>();

// line numbers were added to the dump alongside the strict matcher; for dumps
// produced by an older test run, recompute them from the fixture on disk
const fixtureCache = new Map<string, string>();
const lineOfOffset = (file: string, offset: number): number | undefined => {
  const path = join(root, "audit/fixtures", file);
  if (!existsSync(path)) return undefined;
  let text = fixtureCache.get(file);
  if (text === undefined) {
    text = readFileSync(path, "utf8");
    fixtureCache.set(file, text);
  }
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
};

for (const dump of dumps) {
  // Final painted color per range start. Tokens arrive lexer layer first,
  // daemon layer second, so a plain "last write wins" walk reproduces the
  // editor's layering - except that a token whose keys our scheme does not
  // define paints nothing and must not erase the layer underneath.
  const finalAt = new Map<number, { color: string; key: string; layer: string }>();
  const tokensByStart = new Map<number, DumpToken>();
  for (const t of dump.tokens) {
    tokensByStart.set(t.start, tokensByStart.get(t.start) ?? t);
    // within one token, later keys are applied on top of earlier ones
    let winner: { key: string; color: string } | undefined;
    for (const chain of t.keys) {
      const r = resolve(chain);
      if (r.key === "TEXT" && chain[0] !== "TEXT") {
        unresolvedKeys.set(chain[0], (unresolvedKeys.get(chain[0]) ?? 0) + 1);
        continue; // unknown to our scheme: contributes no color
      }
      winner = r;
    }
    if (winner) finalAt.set(t.start, { ...winner, layer: t.layer });
  }

  for (const e of expectations) {
    if (e.file !== dump.file) continue;
    checked++;
    if (e.text.length > 40) {
      console.log(`INVALID [${ide}] ${dump.file} "${e.text}" - dump text is truncated at 40 chars`);
      failures++;
      continue;
    }
    // candidates: distinct token starts whose text is exactly the expected one
    let candidates = [...tokensByStart.values()]
      .filter((t) => t.text === e.text)
      .sort((a, b) => a.start - b.start);
    if (e.line !== undefined) {
      candidates = candidates.filter(
        (t) => (t.line ?? lineOfOffset(dump.file, t.start)) === e.line
      );
    }
    const where = e.line !== undefined ? `:${e.line}` : "";
    const nth = e.occurrence ?? 1;
    const token = candidates[nth - 1];
    if (!token) {
      console.log(
        `MISSING [${ide}] ${dump.file}${where} "${e.text}" #${nth} - ` +
          `not found in dump (${candidates.length} occurrence(s) matched)`
      );
      failures++;
      continue;
    }
    const painted = finalAt.get(token.start) ?? { color: defaultFg, key: "TEXT", layer: "none" };
    if (painted.color !== expectedColor(e)) {
      console.log(
        `MISMATCH [${ide}] ${dump.file}${where} "${e.text}" #${nth} ` +
          `expected ${e.family ?? e.color} (${expectedColor(e)}), ` +
          `got ${painted.color} via ${painted.key} [${painted.layer}]` +
          (e.note ? `  (${e.note})` : "")
      );
      failures++;
    }
  }
}

// an expectation whose `file` matches no dump is silently never checked - the
// exact failure mode the basename collision used to hide
const dumpFiles = new Set(dumps.map((d) => d.file));
for (const file of new Set(expectations.map((e) => e.file))) {
  if (dumpFiles.has(file)) continue;
  console.log(
    `UNMATCHED [${ide}] expectation file "${file}" has no dump ` +
      `(dumps present: ${[...dumpFiles].join(", ") || "none"})`
  );
  failures++;
}

const topUnresolved =[...unresolvedKeys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
if (topUnresolved.length) {
  console.log("\nkeys resolving to default fg (top 10 - candidates for mapping):");
  for (const [k, n] of topUnresolved) console.log(`  ${k} x${n}`);
}
console.log(`\n${ide}: ${dumps.length} dumps, ${checked} expectations checked, ${failures} failures`);
process.exit(failures > 0 ? 1 : 0);
