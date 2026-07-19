#!/usr/bin/env node
// Resolve the headless IDE highlight dumps (jetbrains-audit/build/dumps/*.json)
// against our generated .icls and check expectations.
//
// The dump carries, per token, the TextAttributesKey fallback chain straight
// from the IDE (e.g. GO_METHOD_RECEIVER -> DEFAULT_PARAMETER). We resolve the
// first key in the chain that our scheme defines - exactly what the IDE's
// scheme inheritance does - so the resulting color is what a user would see.
//
// Expectations live in audit/jetbrains-expected.json:
//   { ide, file, text, color }  - token with this text must resolve to color
// Run after: cd jetbrains-audit && gradle test -PideType=GO|WS
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readJson, root } from "./lib.ts";

interface DumpToken {
  layer: string;
  start: number;
  end: number;
  text: string;
  keys: string[][]; // each entry: key + fallback chain
}
interface Dump {
  file: string;
  tokens: DumpToken[];
}
interface Expectation {
  ide: string;
  file: string;
  text: string;
  color: string;
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

const expectations = readJson<Expectation[]>("audit/jetbrains-expected.json").filter(
  (e) => e.ide === ide
);

let failures = 0;
let checked = 0;
const unresolvedKeys = new Map<string, number>();

for (const dump of dumps) {
  // last write wins per range start: daemon tokens come after lexer tokens
  const byText = new Map<string, Set<string>>();
  for (const t of dump.tokens) {
    for (const chain of t.keys) {
      const { key, color } = resolve(chain);
      if (key === "TEXT" && chain[0] !== "TEXT")
        unresolvedKeys.set(chain[0], (unresolvedKeys.get(chain[0]) ?? 0) + 1);
      const set = byText.get(t.text) ?? new Set<string>();
      set.add(color);
      byText.set(t.text, set);
    }
  }
  for (const e of expectations) {
    if (e.file !== dump.file) continue;
    checked++;
    const colors = byText.get(e.text);
    if (!colors) {
      console.log(`MISSING [${ide}] ${dump.file} "${e.text}" - token not found in dump`);
      failures++;
    } else if (!colors.has(e.color.toLowerCase())) {
      console.log(
        `MISMATCH [${ide}] ${dump.file} "${e.text}" expected ${e.color}, got ${[...colors].join(", ")}` +
          (e.note ? `  (${e.note})` : "")
      );
      failures++;
    }
  }
}

const topUnresolved = [...unresolvedKeys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
if (topUnresolved.length) {
  console.log("\nkeys resolving to default fg (top 10 - candidates for mapping):");
  for (const [k, n] of topUnresolved) console.log(`  ${k} x${n}`);
}
console.log(`\n${ide}: ${dumps.length} dumps, ${checked} expectations checked, ${failures} failures`);
process.exit(failures > 0 ? 1 : 0);
