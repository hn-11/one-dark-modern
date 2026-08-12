// Unit tests for scripts/lib.ts (docs/IMPROVEMENT-IDEAS.md #35).
// node:test, native TS execution - no new deps, no test runner config.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  blend,
  familyColor,
  isPlainObject,
  jsonc,
  raw,
  recolor,
  root,
  uiColor,
  validateColorMap,
  validateSemanticSource,
  validateSyntaxRules,
  _fallbacksUsedForTest,
  type Theme,
} from "./lib.ts";

// The pre-#35 implementation, kept here only to diff against the new,
// string-literal-aware jsonc() on real repo files (see the describe block
// below) - it must NOT regress on any file we actually ship.
const oldJsonc = <T>(s: string): T =>
  JSON.parse(
    s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,(\s*[}\]])/g, "$1")
  ) as T;

describe("jsonc()", () => {
  test("strips // line comments", () => {
    const s = `{\n  // a comment\n  "a": 1\n}`;
    assert.deepEqual(jsonc(s), { a: 1 });
  });

  test("strips /* block */ comments", () => {
    const s = `{ /* c */ "a": 1 /* trailing */ }`;
    assert.deepEqual(jsonc(s), { a: 1 });
  });

  test("strips trailing commas in objects and arrays", () => {
    const s = `{ "a": [1, 2,], "b": 3, }`;
    assert.deepEqual(jsonc(s), { a: [1, 2], b: 3 });
  });

  test("known limitation, now fixed: // inside a string literal is preserved", () => {
    const s = `{ "url": "https://example.com" }`;
    assert.deepEqual(jsonc(s), { url: "https://example.com" });
  });

  test("a literal /* ... */ inside a string is preserved", () => {
    const s = `{ "note": "/* not a comment */" }`;
    assert.deepEqual(jsonc(s), { note: "/* not a comment */" });
  });

  test("a string ending in a comma-like sequence before a brace is untouched", () => {
    const s = `{ "weird": "a,", "b": 1 }`;
    assert.deepEqual(jsonc(s), { weird: "a,", b: 1 });
  });

  test("escaped quotes inside a string don't confuse the scanner", () => {
    const s = String.raw`{ "s": "he said \"//not a comment\"" }`;
    assert.deepEqual(jsonc(s), { s: 'he said "//not a comment"' });
  });

  test("comments and trailing commas can combine", () => {
    const s = `{\n  // leading\n  "a": 1, // trailing line comment\n  "b": [1, 2,],\n}`;
    assert.deepEqual(jsonc(s), { a: 1, b: [1, 2] });
  });

  describe("regression: matches the old regex-based jsonc() on every real repo file", () => {
    const dirs = ["upstream", "overrides", "syntax"];
    for (const dir of dirs) {
      const abs = join(root, dir);
      for (const name of readdirSync(abs)) {
        if (!name.endsWith(".json")) continue;
        test(`${dir}/${name}`, () => {
          const raw = readFileSync(join(abs, name), "utf8");
          const oldResult = oldJsonc<unknown>(raw);
          const newResult = jsonc<unknown>(raw);
          assert.equal(JSON.stringify(newResult), JSON.stringify(oldResult));
        });
      }
    }
  });
});

describe("blend()", () => {
  test("passes through an opaque #rrggbb color unchanged", () => {
    assert.equal(blend("#abcdef", "#000000"), "#abcdef");
  });

  test("mixes an #rrggbbaa color over an opaque base", () => {
    // 50% white over black -> ~#808080
    assert.equal(blend("#ffffff80", "#000000"), "#808080");
  });

  test("full alpha (ff) reduces to the color itself", () => {
    assert.equal(blend("#123456ff", "#000000"), "#123456");
  });

  test("zero alpha (00) reduces to the base", () => {
    assert.equal(blend("#12345600", "#abcdef"), "#abcdef");
  });

  test("throws when base is not an opaque 6-digit color", () => {
    assert.throws(() => blend("#ffffff80", "#00000080"), /base must be an opaque/);
    assert.throws(() => blend("#ffffff80", "not-a-color"), /base must be an opaque/);
  });

  test("throws when color is not 6 or 8 hex digits long", () => {
    assert.throws(() => blend("#fff", "#000000"), /color must be #rrggbb or #rrggbbaa/);
    assert.throws(() => blend("#12345", "#000000"), /color must be #rrggbb or #rrggbbaa/);
  });
});

describe("raw()", () => {
  test("passes a 6-digit color through, lowercased, without #", () => {
    assert.equal(raw("#ABCDEF"), "abcdef");
  });

  test("truncates an 8-digit color to its 6-digit RGB", () => {
    assert.equal(raw("#abcdef80"), "abcdef");
  });

  test("empty string is passed through as the deliberate 'unset' value", () => {
    assert.equal(raw(""), "");
  });

  test("throws on an invalid hex value", () => {
    assert.throws(() => raw("#zzz"), /raw: expected/);
    assert.throws(() => raw("#abcd"), /raw: expected/);
  });
});

describe("recolor()", () => {
  test("replaces the RGB part of a matching opaque color", () => {
    const out = recolor({ a: "#528bff" }, { "#528bff": "#c678dd" });
    assert.equal(out.a, "#c678dd");
  });

  test("preserves an alpha suffix on the replaced color", () => {
    const out = recolor({ a: "#528bff60" }, { "#528bff": "#c678dd" });
    assert.equal(out.a, "#c678dd60");
  });

  test("leaves non-matching colors untouched", () => {
    const out = recolor({ a: "#ffffff" }, { "#528bff": "#c678dd" });
    assert.equal(out.a, "#ffffff");
  });

  test("is case-insensitive on both sides", () => {
    const out = recolor({ a: "#528BFF" }, { "#528bff": "#C678DD" });
    assert.equal(out.a, "#c678dd");
  });

  test("does not match a longer or differently-suffixed value", () => {
    // "#528bff" must not match inside "#528bff1234" (not a valid 2-digit
    // alpha tail) - the whole thing should be left alone.
    const out = recolor({ a: "#528bff1234" }, { "#528bff": "#c678dd" });
    assert.equal(out.a, "#528bff1234");
  });

  test("throws on a map key that isn't a full #rrggbb color", () => {
    assert.throws(() => recolor({ a: "#528bff" }, { "528bff": "#c678dd" }), /full #rrggbb/);
    assert.throws(() => recolor({ a: "#528bff" }, { "#52f": "#c678dd" }), /full #rrggbb/);
  });
});

describe("familyColor()", () => {
  const families = { keyword: "#c678dd", string: "#98c379" };

  test("returns the color for a known family", () => {
    assert.equal(familyColor(families, "string"), "#98c379");
  });

  test("throws on an unknown family", () => {
    assert.throws(() => familyColor(families, "nope"), /unknown family: nope/);
  });
});

describe("uiColor()", () => {
  const stubTheme = (): Theme => ({
    colors: { "editor.background": "#1f1f1f" },
    tokenColors: [],
  });

  test("returns the theme's value when the key is present", () => {
    assert.equal(uiColor(stubTheme(), "editor.background", "#000000"), "#1f1f1f");
  });

  test("returns the fallback when the key is missing", () => {
    assert.equal(uiColor(stubTheme(), "does.not.exist", "#abcdef"), "#abcdef");
  });

  test("records missing keys for warnFallbacksUsed()", () => {
    _fallbacksUsedForTest.clear();
    uiColor(stubTheme(), "some.missing.key", "#abcdef");
    assert.ok(_fallbacksUsedForTest.has("some.missing.key"));
    uiColor(stubTheme(), "editor.background", "#000000");
    assert.equal(_fallbacksUsedForTest.size, 1); // present key isn't recorded
    _fallbacksUsedForTest.clear();
  });
});

describe("validateColorMap()", () => {
  test("accepts an object of string -> string", () => {
    assert.deepEqual(validateColorMap("t", { a: "#fff" }), { a: "#fff" });
  });

  test("rejects a non-object", () => {
    assert.throws(() => validateColorMap("t", ["not", "an", "object"]), /expected an object/);
    assert.throws(() => validateColorMap("t", null), /expected an object/);
    assert.throws(() => validateColorMap("t", "str"), /expected an object/);
  });

  test("rejects a non-string value, naming the offending key", () => {
    assert.throws(() => validateColorMap("t", { a: 5 }), /t\.\"a\": expected a string value/);
  });
});

describe("validateSyntaxRules()", () => {
  const families = { keyword: "#c678dd" };

  test("accepts a well-formed rule list", () => {
    const rules = [{ family: "keyword", scope: ["a.b"], settings: { fontStyle: "italic" } }];
    assert.deepEqual(validateSyntaxRules(rules, families), rules);
  });

  test("accepts the style-only pseudo-family without requiring it in families", () => {
    const rules = [{ family: "style-only", scope: ["a.b"], settings: { fontStyle: "underline" } }];
    assert.deepEqual(validateSyntaxRules(rules, families), rules);
  });

  test("rejects a non-array", () => {
    assert.throws(() => validateSyntaxRules({}, families), /expected an array/);
  });

  test("rejects an unknown family", () => {
    assert.throws(
      () => validateSyntaxRules([{ family: "nope", scope: ["a"] }], families),
      /unknown family "nope"/
    );
  });

  test("rejects a missing or empty scope array", () => {
    assert.throws(
      () => validateSyntaxRules([{ family: "keyword", scope: [] }], families),
      /non-empty array of strings/
    );
    assert.throws(
      () => validateSyntaxRules([{ family: "keyword", scope: "a.b" }], families),
      /non-empty array of strings/
    );
  });

  test("rejects non-string settings values", () => {
    assert.throws(
      () => validateSyntaxRules([{ family: "keyword", scope: ["a"], settings: { x: 1 } }], families),
      /settings must be an object of string values/
    );
  });
});

describe("validateSemanticSource()", () => {
  const families = { type: "#e5c07b" };

  test("accepts a well-formed entry map", () => {
    const src = { class: { family: "type" }, enum: { family: "type", italic: true } };
    assert.deepEqual(validateSemanticSource(src, families), src);
  });

  test("rejects a non-object", () => {
    assert.throws(() => validateSemanticSource([], families), /expected an object/);
  });

  test("rejects an unknown family", () => {
    assert.throws(
      () => validateSemanticSource({ class: { family: "nope" } }, families),
      /unknown family "nope"/
    );
  });

  test("rejects a non-boolean italic", () => {
    assert.throws(
      () => validateSemanticSource({ class: { family: "type", italic: "yes" } }, families),
      /italic: expected a boolean/
    );
  });
});

describe("isPlainObject()", () => {
  test("true for object literals", () => {
    assert.equal(isPlainObject({}), true);
  });
  test("false for arrays, null, and primitives", () => {
    assert.equal(isPlainObject([]), false);
    assert.equal(isPlainObject(null), false);
    assert.equal(isPlainObject("x"), false);
    assert.equal(isPlainObject(5), false);
  });
});
