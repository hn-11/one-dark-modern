#!/usr/bin/env node
// Validate the generated .icls attribute keys against a corpus of keys
// harvested from production JetBrains themes (one-dark, dracula, material).
// IntelliJ silently ignores unknown keys, so a typo'd key means a silently
// broken color - this catches that class of bug (the GO_METHOD_RECEIVER
// incident) at build time.
//
// audit/jetbrains-known-keys.json maps key -> source scheme file it was
// seen in. Regenerate/extend it by harvesting more theme repos or an
// installed IDE, then commit the result.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readJson, root } from "./lib.ts";

const known = readJson<Record<string, string>>("audit/jetbrains-known-keys.json");
const icls = readFileSync(join(root, "dist/jetbrains/OneDarkModern.icls"), "utf8");
const block = icls.match(/<attributes>[\s\S]*<\/attributes>/)?.[0] ?? "";
const ours = [...block.matchAll(/<option name="([^"]+)">/g)].map((m) => m[1]);

const unknown = ours.filter((k) => !known[k]);
for (const k of unknown) console.log(`UNKNOWN ATTRIBUTE KEY: ${k}`);
console.log(`jetbrains keys: ${ours.length} checked, ${unknown.length} unknown`);
process.exit(unknown.length > 0 ? 1 : 0);
