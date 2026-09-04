# Design Philosophy

> 日本語版: [PHILOSOPHY.ja.md](PHILOSOPHY.ja.md)

This document explains why this theme colors what it colors: what the theme
is, what each color means, and the principles every color decision is argued
from. The decisions themselves, with their evidence and history, are in
[DECISIONS.md](DECISIONS.md); references like "Decisions §3" point there.
How the theme is built, verified and maintained is in the
[README](../README.md).

Terms used throughout (One Dark Pro, TextMate, semantic tokens, base16,
flicker) are defined in the glossary at the end.

## Part I — What the theme is

### 1. What is built

Two themes are built from one pipeline: one syntax interpretation across two
workbench generations.

| Theme | Workbench |
|---|---|
| One Dark Modern | VS Code Dark Modern |
| One Dark 2026 | VS Code 2026 Dark (accent recolored to `#528BFF`) |

Backgrounds always come from the workbench generation, never from the syntax
layer.

The theme is a blend of three things: this repository's One Dark syntax
colors, the Dark Modern UI (`#181818`/`#1F1F1F`, accent `#0078D4`), and Atom
one-dark-ui's 16-color ANSI terminal palette. That blend is the concept.

### 2. The color vocabulary

Each color stands for a family of meaning. Being able to read a symbol's kind
from its color is the theme's main value, so borrowing a color for another
family is not allowed by default: it dilutes the mapping.

The families below are the ones in `syntax/families.json`. Every rule in
`syntax/tokens.json` and `syntax/semantic.json` names one of them, and the
build rejects any other color. The table is therefore the executable
vocabulary, not just documentation.

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
| `plain` | Foreground | `#ABB2BF` | Punctuation, type-annotation marks — the deliberate choice *not* to highlight |
| `invalid` | Error red | `#F44747` | Illegal, broken, deprecated and unimplemented tokens |

A pseudo-family `style-only` carries font style without a color (parameter
italic, JS/TS attribute italic, Markdown italic and underline).

Two exceptions to the family rule are accepted deliberately:

- Shell command names are green (the string color), to match
  zsh-syntax-highlighting in terminals (Decisions §7).
- Yellow and orange split strictly into two worlds: yellow is the type world,
  orange is the value world. A symbol that names a type is yellow even if it
  is builtin (`int`, `string` in Go); a symbol that names a value is orange
  even if it is SCREAMING_CASE (Decisions §2, §3).

#### An example

```ts
import { readFile } from "node:fs/promises";

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
| `path` (parameter, italic), `length` | `variable-and-key` (red) |
| `string` | `type` (yellow) |
| `MAX_RETRIES`, `text` (a `const` local is a constant; Decisions §2) | `value-constant` (orange) |
| `=` | `platform-and-operator` (cyan) |
| `${` `}` | `embedded-boundary` (dark red) |
| `:` `{` `}` `(` `)` `,` `;` `.` | `plain` (foreground) |

### 3. Non-goals

- The UI layer is not a design surface. It stays on Dark Modern / 2026 Dark
  except where something is genuinely hard to see or easy to confuse
  (Decisions §8).
- Imitating VS Code Dark+ or any other theme is not a goal in itself
  (Decisions §5).
- Reproducing another editor's interpretation is a research tool, not a
  product. The Zed variants were retired for that reason (Decisions,
  Appendix).
- Platform limits are not fought. A distinction a platform cannot express is
  documented as a divergence in `audit/jetbrains-expected.json`, not worked
  around (README, JetBrains headless audit).

## Part II — How we decide

### 4. Provenance: where a color comes from decides how much weight it carries

An inherited color is only as authoritative as its history. "It was in
One Dark Pro" stops being a reason once the history is known. One Dark exists
in many implementations that disagree, and when they do, we settle the
disagreement with evidence, not by which implementation this theme happens to
descend from.

#### The five sources

Provenance review draws on five generations of the One Dark family:

1. TextMate-era Atom (`atom/one-dark-syntax` before 2018) — the origin.
2. Tree-sitter-era Atom (2018 onward) — the same team after the engine
   migration. Some colors changed deliberately; others were lost in
   translation because their grammar scopes no longer existed.
3. base16 (Kempson's 16-slot standard, with base16-onedark) — the only source
   that documents color roles in writing ("base09: Integers, Boolean,
   Constants, XML Attributes"). That makes it the reference for
   what-a-color-means disputes, though it is coarse (16 slots) and was not
   written by the One Dark authors.
4. Zed — the Atom team's later editor. It began as a base16 derivative (2022)
   and was hand-tuned toward Atom fidelity in 2023 (issue #5793). It carries
   real ancestry plus a few inventions of its own.
5. The official tree-sitter grammar queries (snapshotted in
   `audit/provenance/official-treesitter/`). These say a lot about which
   distinctions exist (is `=>` an operator? is `nil` grouped with `true`?),
   nothing about colors, and they are not always right: their vocabulary is
   uneven across grammars and they encode heuristics such as treating
   SCREAMING-case names as `@constructor`.

#### How we weigh them

This is not vote-counting. Some patterns we have found reliable:

- A deviation found in only one source is suspect (Zed's blue markup tags,
  One Dark Pro's cyan carve-out for logical operators).
- When TextMate-Atom and Zed agree against One Dark Pro, One Dark Pro
  usually drifted; we restored such colors to the origin.
- When sources split cleanly by era (types: yellow in the TextMate
  generation, cyan in the tree-sitter generation), both positions are
  legitimate ancestry, and we follow the generation our own stack descends
  from.
- A split that no source makes is weaker than any source's position.
  Painting all symbol operators one color is a position; splitting logical
  operators from the rest is an invention.

#### The wider ecosystem

Where the five sources leave a thin margin, we also look at the wider
ecosystem as an advisory sixth source. A survey of eight further
implementations (JetBrains' one-dark plugin, akamud's Atom-generated VS Code
port, the joshdick/navarasu/olimorris Vim/Neovim themes, the Sublime port,
two Emacs themes) tells us whether a position is a broad consensus, a
signature of one branch of the family, or found nowhere else. Findings that
changed decisions are recorded in DECISIONS.md. The survey also confirmed
that types-yellow is unanimous across the ecosystem and that the `${}` dark
red is carried by every Atom-faithful port.

### 5. Layering: lexical belongs to TextMate; semantic corrects

- What cannot be misclassified (keywords, strings, numbers, comments,
  operators, punctuation) belongs to TextMate. Regexes are enough there, and
  TextMate keeps working before the language server starts and inside
  Markdown fences.
- What can be misclassified (the role of an identifier: variable, type or
  function?) is corrected by semantic tokens.
- So a semantic rule that repaints a color TextMate set deliberately is a
  bug. Semantic rules may only fill in tokens TextMate left at the plain
  foreground, or fix places where TextMate's own guess is wrong.
- `npm run audit` (real grammars plus real language servers) enforces this
  mechanically: a TextMate/semantic disagreement is a *flicker* violation.
  Exceptions exist only in `audit/allow.json`, each with a reason.

Decisions argued from this principle: removing the semantic `operator` entry
(Decisions §1), reverting the `function.defaultLibrary` fix (Decisions §9),
and the flicker violations that completed the constant merge (Decisions §2).

### 6. Identity: same symbol, same color

Color attaches to what a symbol is, not to where it is written.

The defining case is One Dark Pro's yellow dot-receiver, under which the same
variable changes color depending on whether it precedes a dot. We rejected it
(Decisions §4). The same principle decides `this`/`self`: they are values, so
they wear variable red rather than a special color (Decisions §4).

When this principle and upstream fidelity (§7) collide, this principle wins.

### 7. Pragmatism about upstream

We tried a faithful rebuild from `atom/one-dark-syntax` once and rejected it:
gray parameters, foreground operators and dark comments did not survive daily
use. One Dark Pro's ~150 language-specific rules are a decade of tuning
against real grammars and are valuable, but One Dark Pro is a dependency we
review, not an authority. Its rules stood only until provenance review found
one with a weak history (§4, DECISIONS.md). It started as the reference,
became a dependency reviewed rule by rule, and is now one source among
several. Since v0.1.0 its changes are not synced; anything worth importing
arrives the way any other source's position does, through a decision.

The yardstick for taste calls is eyes calibrated by years of daily use of
this family of themes. Two consequences are recorded honestly. We keep two
One Dark Pro signatures purely on taste: parameter italic (Decisions §4),
and, for a long time before the evidence retired it, constants-yellow
(Decisions §2). And we once rejected a scheme that was correct on paper
(all-plain operators, Decisions §1) because it looked wrong in practice.
History proposes a color; daily use has the final say.

### 8. Decisions are written down with reasons

The reason behind a color lives in machine-readable places, not in chat logs
or commit messages:

- `audit/allow.json` — where semantic may override TextMate, and why
- `audit/jetbrains-expected.json` — colors guaranteed in the real IDEs, and
  documented divergences
- `DECISIONS.md` — the contested decisions, with evidence and history
- this document — the principles

Together they are the record of earlier decisions. Check a change against
that record first, and when a change settles a new question, record it in
DECISIONS.md.

### 9. Measure, don't assume

Colors are verified against real engines, not against knowledge, mapping
tables or corpora:

- VS Code: `vscode-textmate` plus gopls / typescript-language-server
  (`npm run audit`)
- JetBrains: headless GoLand / WebStorm dumping actual token attribute keys
  with fallback chains (`jetbrains-audit/`)
- 2026 accent: a hue-band scan guards the 13-color accent family remap

Evidence from this repository's history that assumptions fail: a careful
manual audit misjudged the builtin color; a theme-corpus check missed the
real key `GO_LOCAL_VARIABLE`; a plausible semantic "fix" was falsified by the
harness before it shipped (Decisions §9); a principle change tripped three
flicker violations that located the one rule the sweep had missed
(Decisions §2). Every bug class that happened once gets a machine guard.

Verification effort is proportional to how much intelligence sits between
the theme and the pixels: IntelliJ > VS Code > Vim > terminals (passive
palettes; generation correctness is all there is to check).

## Glossary

- One Dark Pro — the VS Code theme whose language rules this repository
  absorbed and then reviewed rule by rule (§7).
- TextMate — the regex-based grammar layer VS Code uses for lexical
  highlighting; it works without a language server (§5).
- Semantic tokens / LSP — role information (variable, type, function)
  supplied by a language server, layered on top of TextMate (§5).
- Flicker — a token whose TextMate color and semantic color disagree, so it
  visibly changes color when the language server starts; the unit of the
  `npm run audit` layering check (§5).
- base16 — Kempson's 16-slot color-scheme standard; its documented slot roles
  make it the reference for meaning disputes (§4).
- Source — one of the five One Dark generations consulted in provenance
  review (§4).
- Family — a named meaning group in `syntax/families.json`, the unit in which
  colors are assigned (§2).
- `allow.json` — the list of accepted TextMate/semantic disagreements, each
  with a reason (§8).
- Dark+ / Dark Modern / 2026 Dark — VS Code's own default dark themes. Dark
  Modern and 2026 Dark supply this theme's workbench UI; Dark+ matters only
  as the thing One Dark Pro once imitated (Decisions §5).
- Workbench — VS Code's UI chrome (sidebars, tabs, terminal), as opposed to
  the editor's syntax colors (§1, Decisions §8).
