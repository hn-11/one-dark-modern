# Design Philosophy

> 日本語版: [PHILOSOPHY.ja.md](PHILOSOPHY.ja.md)

This document explains why the theme colors what it colors: what the theme
is, what each color means, and the principles we argue color decisions
from. The decisions themselves, with their evidence and history, live in
[DECISIONS.md](DECISIONS.md), and a reference like "Decisions §3" points
there. How the theme is built, verified and maintained is described in the
[README](../README.md).

One Dark Pro, TextMate, semantic tokens, base16 and flicker are defined in
the glossary at the end.

## Part I — What the theme is

### 1. What is built

One pipeline builds two themes. They share one syntax interpretation and
differ only in the workbench generation underneath.

| Theme | Workbench |
|---|---|
| One Dark Modern | VS Code Dark Modern |
| One Dark 2026 | VS Code Dark 2026 (accent recolored to `#528BFF`) |

Backgrounds always come from the workbench generation; the syntax layer
never sets them.

The theme blends three things: this repository's own One Dark syntax
colors, the Dark Modern UI with its `#181818`/`#1F1F1F` surfaces and
`#0078D4` accent, and the 16-color ANSI terminal palette from Atom's
one-dark-ui. That blend is the whole concept.

### 2. The color vocabulary

Each color stands for a family of meaning, and you should be able to tell
what kind of symbol you are looking at from its color alone. That is the
main thing the theme offers, so borrowing a color for a second family is not
allowed by default. Every borrowed color makes the mapping a little less
readable.

The families below are the ones in `syntax/families.json`. Every rule in
`syntax/tokens.json` and `syntax/semantic.json` names one of them, and the
build rejects any other color, so the table is not just documentation. It
is the vocabulary the build enforces.

| Family | Color | Value | What it covers |
|---|---|---|---|
| `keyword` | Purple | `#C678DD` | Control flow, storage, and word operators (`func` `if` `const` `import` `new` `typeof` `and`) |
| `callable` | Blue | `#61AFEF` | Functions, methods, decorators, macros |
| `type` | Yellow | `#E5C07B` | The type family, and nothing else: class, interface, enum, namespace, struct, type parameter |
| `variable-and-key` | Red | `#E06C75` | The variable family (variables, fields, parameters, `this`/`self`); key-like names (JSON/YAML keys, CSS property names); markup tags; headings |
| `platform-and-operator` | Cyan | `#56B6C2` | Names the platform provides (builtins, escapes, regexps, shell flags) and symbol operators (`=` `=>` `&&` `? :`) |
| `string` | Green | `#98C379` | Strings, inserted diffs, shell command names |
| `value-constant` | Orange | `#D19A66` | Numbers, booleans, `nil`/`null`, named constants, enum members, platform constants (`Math.PI`); also attribute names and bold markup |
| `embedded-boundary` | Dark red | `#BE5046` | Boundaries between languages: `${}` in templates, JSX expression braces, `variable.interpolation` |
| `comment` | Gray | `#7F848E` | Comments (italic) |
| `comment-dim` | Dim gray | `#5C6370` | Links inside comments, Markdown block quotes |
| `plain` | Foreground | `#ABB2BF` | Punctuation and type-annotation marks, which we deliberately leave unhighlighted |
| `invalid` | Error red | `#F44747` | Illegal, broken, deprecated and unimplemented tokens |

There is also a pseudo-family, `style-only`, which carries font style but no
color: parameter italic, JS/TS attribute italic, and Markdown italic and
underline.

We allow two exceptions to the family rule on purpose. Shell command names
are green (the string color) because that is what zsh-syntax-highlighting
does in a terminal; see Decisions §7. And yellow and orange are split into
two worlds rather than two families — yellow is the type world, orange is
the value world. A symbol that names a type is yellow even when it is
builtin, like `int` or `string` in Go, and a symbol that names a value is
orange even when it is written in SCREAMING_CASE. Decisions §2 and §3 have
the details.

#### An example

```ts
import { readFile } from "node:fs/promises";

const MAX_RETRIES = 3;

export async function load(path: string, retries = MAX_RETRIES) {
  const text = await readFile(path);
  return `${text.length} bytes`;
}
```

| Tokens | Family |
|---|---|
| `import` `from` `export` `async` `function` `const` `await` `return` | `keyword` (purple) |
| `readFile` `load` | `callable` (blue) |
| `"node:fs/promises"` and the template string text | `string` (green) |
| `path` and `retries` (parameters, italic), `length` | `variable-and-key` (red) |
| `string` | `type` (yellow) |
| `3`, `MAX_RETRIES`, `text` (a `const` local is a constant; Decisions §2) | `value-constant` (orange) |
| `=` | `platform-and-operator` (cyan) |
| `${` `}` | `embedded-boundary` (dark red) |
| `:` `{` `}` `(` `)` `,` `;` `.` | `plain` (foreground) |

These are the colors with the TypeScript language server running. TextMate
alone paints `text` before the dot and the imported `readFile` differently;
that gap is the sanctioned exception described in Decisions §4.

### 3. Non-goals

- The UI layer is not a design surface. It stays on Dark Modern or 2026
  Dark unless something is genuinely hard to see or easy to confuse; see
  Decisions §8.
- We do not imitate VS Code Dark+ or any other theme for its own sake.
  Decisions §5 has the one case where this came up.
- We do not ship reproductions of other editors' interpretations. They are
  useful as research tools, and the Zed variants were retired once they had
  served that purpose; see the appendix of DECISIONS.md.
- We do not fight platform limits. When a platform cannot express a
  distinction, we document the divergence in `audit/jetbrains-expected.json`
  and move on. The README's JetBrains section lists the known cases.

## Part II — How we decide

### 4. Provenance: where a color comes from decides how much weight it carries

An inherited color is only as authoritative as its history, and "it was in
One Dark Pro" stops being a reason once you know where One Dark Pro got it.
One Dark exists in many implementations, and they disagree. When they do,
we settle the disagreement with evidence rather than by asking which
implementation this theme happens to descend from.

#### The five sources

Provenance review draws on five generations of the One Dark family.

1. TextMate-era Atom, meaning `atom/one-dark-syntax` before 2018. This is
   the origin.
2. Tree-sitter-era Atom, from 2018 onward: the same team on a new engine.
   Some colors changed deliberately, and others were lost in translation
   because their grammar scopes no longer existed.
3. base16, Kempson's 16-slot standard, together with base16-onedark. It is
   the only source that documents color roles in writing ("base09:
   Integers, Boolean, Constants, XML Attributes"), which makes it the
   reference for arguments about what a color means. It is coarse, with
   only 16 slots, and the One Dark authors did not write it.
4. Zed, the editor the Atom team built next. It began as a base16
   derivative in 2022 and was hand-tuned toward Atom fidelity in 2023
   (issue #5793), so it carries real ancestry along with a few inventions
   of its own.
5. The official tree-sitter grammar queries, snapshotted under
   `audit/provenance/official-treesitter/`. They say a lot about which
   distinctions exist (is `=>` an operator? is `nil` grouped with `true`?)
   and nothing about colors, and they are not always right: their
   vocabulary is uneven across grammars, and they encode heuristics such as
   treating any SCREAMING-case name as `@constructor`.

#### How we weigh them

This is not vote-counting, but a few patterns have proven reliable.

- A deviation found in only one source is suspect. Zed's blue markup tags
  are one example; One Dark Pro's cyan carve-out for logical operators is
  another.
- When TextMate-Atom and Zed agree against One Dark Pro, One Dark Pro has
  usually drifted, and we restored such colors to the origin.
- When the sources split cleanly by era, both positions are legitimate
  ancestry. Types are yellow in the TextMate generation and cyan in the
  tree-sitter generation, and in such cases we follow the generation our
  own stack descends from.
- A split that no source makes is weaker than any source's position.
  Painting all symbol operators one color is a position; splitting logical
  operators off from the rest is an invention.

#### The wider ecosystem

When the five sources leave only a thin margin, we look at the wider
ecosystem as an advisory sixth source. We surveyed eight further
implementations: JetBrains' one-dark plugin, akamud's Atom-generated VS Code
port, the joshdick, navarasu and olimorris Vim/Neovim themes, the Sublime
port, and two Emacs themes. The survey tells us whether a position is a
broad consensus, the signature of one branch of the family, or something
found nowhere else, and findings that changed a decision are recorded in
DECISIONS.md. It also confirmed two things: types-yellow is unanimous
across the ecosystem, and every Atom-faithful port carries the `${}` dark
red.

### 5. Layering: lexical belongs to TextMate; semantic corrects

What cannot be misclassified belongs to TextMate. Keywords, strings,
numbers, comments, operators and punctuation are all in this group; regexes
are enough for them, and TextMate keeps working before the language server
starts and inside Markdown fences.

What can be misclassified is corrected by semantic tokens. The role of an
identifier is the main case: is it a variable, a type, or a function?

So a semantic rule that repaints a color TextMate set deliberately is a bug.
Semantic rules may fill in tokens that TextMate left at the plain foreground
and fix places where TextMate's own guess is wrong, and nothing else.

The flicker audit described in the README enforces this against real
grammars and real language servers, and the sanctioned exceptions live in
`audit/allow.json`, each with a reason.

Three decisions follow from this principle: the semantic `operator` entry
was removed (Decisions §1), the `function.defaultLibrary` fix was reverted
(Decisions §9), and flicker violations completed the constant merge
(Decisions §2).

### 6. Identity: same symbol, same color

Color attaches to what a symbol is, not to where the symbol is written.

The defining case is One Dark Pro's yellow dot-receiver, under which the
same variable changes color depending on whether a dot follows it. We
rejected it. The same principle decides `this` and `self`: they are values,
so they get variable red rather than a color of their own. Both cases are
in Decisions §4.

When this principle collides with the upstream pragmatism of §7, this
principle wins.

### 7. Pragmatism about upstream

We tried a faithful rebuild from `atom/one-dark-syntax` once and gave it up,
because gray parameters, foreground operators and dark comments did not
survive daily use. One Dark Pro's roughly 150 language-specific rules are a
decade of tuning against real grammars, and that is worth a lot. But One
Dark Pro is a dependency we review rather than an authority we follow, and
each of its rules stood only until provenance review found one with a weak
history. It started as the reference, became a dependency reviewed rule by
rule, and is now one source among several. Anything worth importing from
it arrives the way any other source's position does, through a decision.

For taste calls the yardstick is eyes calibrated by years of daily use of
this family of themes. That has had two consequences, and we record both
honestly. First, we keep two One Dark Pro signatures purely on taste:
parameter italic, and constants-yellow, which we kept for a long time
before the evidence retired it. Decisions §4 and §2 tell both stories. Second, we once
rejected a scheme that was correct on paper — the all-plain operators of
Decisions §1 — because it looked wrong in practice. History proposes a
color; daily use has the final say.

## Glossary

- One Dark Pro: the VS Code theme whose language rules this repository
  absorbed and then reviewed rule by rule (§7).
- TextMate: the regex-based grammar layer VS Code uses for lexical
  highlighting. It works without a language server, which is the point of
  §5.
- Semantic tokens, LSP: role information such as variable, type or function,
  supplied by a language server and layered on top of TextMate (§5).
- Flicker: a token whose TextMate color and semantic color disagree, so that
  it visibly changes color when the language server starts. It is the unit
  of the `npm run audit` layering check (§5).
- base16: Kempson's 16-slot color-scheme standard, whose documented slot
  roles make it the reference for arguments about meaning (§4).
- Source: one of the five One Dark generations that §4 consults in
  provenance review.
- Family: a named meaning group in `syntax/families.json`, the unit in which
  colors are assigned (§2).
- `allow.json`: the list of accepted TextMate/semantic disagreements, each
  with a reason (§5).
- Dark+, Dark Modern, Dark 2026: VS Code's own default dark themes. Dark
  Modern and Dark 2026 supply this theme's workbench UI; Dark+ matters only
  as the theme One Dark Pro once imitated (Decisions §5).
- Workbench: VS Code's UI chrome (sidebars, tabs, the terminal), as opposed
  to the editor's syntax colors (§1, Decisions §8).
