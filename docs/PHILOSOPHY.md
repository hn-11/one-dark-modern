# Design Philosophy

> 日本語版: [PHILOSOPHY.ja.md](PHILOSOPHY.ja.md)

This document explains why this theme colors what it colors. Every color
decision in the repository should be derivable from it. When a new question
comes up, check the decisions recorded here before inventing an answer.

It has four parts:

- Part I — What the theme is (§1–2): identity and the color vocabulary.
- Part II — How we decide (§3–8): the principles every decision is argued
  from.
- Part III — The decisions (§9–17): the record of contested decisions by
  token family, and the mistakes we corrected.
- Part IV — Architecture and operations (§18–21): where the colors live, how
  they are generated and verified, and how the repository is maintained.

Two appendices hold the Zed episode (A) and a glossary (B). Terms used
throughout — One Dark Pro, TextMate, semantic tokens, base16, flicker — are
defined in the glossary.

---

## Part I — What the theme is

### 1. Identity

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

(Two further themes reproducing Zed's One Dark interpretation verbatim
shipped between v0.0.x releases and were retired at v0.1.0; see Appendix A.)

### 2. The color vocabulary

Each color stands for a family of meaning. Being able to read a symbol's kind
from its color is the theme's main value, so borrowing a color for another
family is not allowed by default: it dilutes the mapping.

The families below are the ones in `syntax/families.json`. Every rule in
`syntax/tokens.json` and `syntax/semantic.json` names one of them, and the
build rejects any other color (§19). The table is therefore the executable
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
  zsh-syntax-highlighting in terminals (§15).
- Yellow and orange split strictly into two worlds: yellow is the type world,
  orange is the value world. A symbol that names a type is yellow even if it
  is builtin (`int`, `string` in Go); a symbol that names a value is orange
  even if it is SCREAMING_CASE (§10, §11).

---

## Part II — How we decide

### 3. Provenance: where a color comes from decides how much weight it carries

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
changed decisions are recorded in Part III. The survey also confirmed that
types-yellow is unanimous across the ecosystem and that the `${}` dark red is
carried by every Atom-faithful port.

### 4. Layering: lexical belongs to TextMate; semantic corrects

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
(§9), reverting the `function.defaultLibrary` fix (§17), and the flicker
violations that completed the constant merge (§10).

### 5. Identity: same symbol, same color

Color attaches to what a symbol is, not to where it is written.

The defining case is One Dark Pro's yellow dot-receiver, under which the same
variable changes color depending on whether it precedes a dot. We rejected it
(§12). The same principle decides `this`/`self`: they are values, so they
wear variable red rather than a special color (§12).

When this principle and upstream fidelity (§6) collide, this principle wins.

### 6. Pragmatism about upstream

We tried a faithful rebuild from `atom/one-dark-syntax` once and rejected it:
gray parameters, foreground operators and dark comments did not survive daily
use. One Dark Pro's ~150 language-specific rules are a decade of tuning
against real grammars and are valuable, but One Dark Pro is a dependency we
review, not an authority. Its rules stood only until provenance review found
one with a weak history (§3, Part III). It started as the reference, became
a dependency reviewed rule by rule, and is now one source among several.
Since v0.1.0 its changes are not synced (§19); anything worth importing
arrives the way any other source's position does, through a decision.

The yardstick for taste calls is eyes calibrated by years of daily use of
this family of themes. Two consequences are recorded honestly. We keep two
One Dark Pro signatures purely on taste: parameter italic (§12), and, for a
long time before the evidence retired it, constants-yellow (§10). And we once
rejected a scheme that was correct on paper (all-plain operators, §9)
because it looked wrong in practice. History proposes a color; daily use has
the final say.

### 7. Decisions are written down with reasons

The reason behind a color lives in machine-readable places, not in chat logs
or commit messages:

- `audit/allow.json` — where semantic may override TextMate, and why
- `audit/jetbrains-expected.json` — colors guaranteed in the real IDEs, and
  documented divergences
- this document — principles and decisions

Together they are the record of earlier decisions. Check a change against
that record first.

### 8. Measure, don't assume

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
harness before it shipped (§17); a principle change tripped three flicker
violations that located the one rule the sweep had missed (§10). Every bug
class that happened once gets a machine guard.

Verification effort is proportional to how much intelligence sits between
the theme and the pixels: IntelliJ > VS Code > Vim > terminals (passive
palettes; generation correctness is all there is to check).

---

## Part III — The decisions

The record of contested decisions, by token family. Each entry states the
decision first, then the evidence and the history behind it. Dates are kept
where known, because several decisions replace earlier ones.

### 9. Operators

- **Symbol operators are cyan `#56B6C2`, in every language** (2026-07-20).
  Evidence: no source splits the operator family. TextMate-era Atom made all
  operators purple; late Atom left all plain; Zed makes all cyan; base16
  files operators under base05 (foreground). The ecosystem survey later
  showed cyan is one of three viable camps (plain/cyan/purple), shared with
  akamud and One Dark Pro.nvim.
  History: One Dark Pro shipped a mix (logical operators cyan,
  ternary/optional purple via a word-operator group, arrow purple, the rest
  plain). The mix failed provenance review and was dropped in one sweep. An
  all-plain scheme, correct on paper, shipped first and was reversed on sight
  the same day: washed-out operators did not survive daily use, and we
  adopted Zed's all-cyan position instead.
- **`=>` is an operator, not a keyword** (2026-07-20). The purple arrow
  (TextMate-Atom and One Dark Pro) lost to the modern sources: the official
  tree-sitter queries list `"=>"` in the same `@operator` capture as every
  other symbol.
- **Word operators stay purple**: `new`, `typeof`, `instanceof`, `in`, `of`,
  `delete`, `void`, Python's `and/or/not`. Words are keywords, symbols are
  operators, and each family is uniform inside.
- **Type-world marks stay plain**: annotation `:`, optional `?`, union `|`.
  Zed paints these dark red (`punctuation.special`); that is Zed's own
  invention and we did not import it.
- **Go's operators are one cyan family** (`:=` `+` `*` `&` `&&` `==`).
  One Dark Pro's Go quirks (`:=` yellow from a 2018 commit with no stated
  reason, pointer-purple from a 2020 bug-report patch) were dropped. When the
  generic operator decision later threatened to leave Go's `&&` plain, a
  `.go`-scoped entry kept the family whole.
- **No semantic `operator` entry.** rust-analyzer and other servers were
  flattening TextMate's per-language operator colors, so the entry was
  removed under the layering principle (§4).

### 10. Constants and literals

- **Named constants merged into the orange value family** (2026-07-20):
  `const` locals, SCREAMING constants, enum members and platform constants
  (`Math.PI`, `JSON`) all wear `#D19A66`, like numbers and booleans. Since
  this merge, yellow means exactly one thing: the type family.
  Evidence: the old yellow split was a One Dark Pro signature that no other
  branch of the family shares (the few ecosystem themes that split use cyan
  or violet); base16 files constants and literals together under base09.
  History: the merge initially left `variable.defaultLibrary` yellow. Three
  new flicker violations on `JSON` caught it, and the audit forced the fix
  before release. The principle change located the one rule the sweep had
  missed.
- **`nil`/`null`/`None` are orange**: they are literals. Zed's yellow `nil`
  is isolated twice over. No other implementation uses yellow, and Zed's own
  query splits `nil` from `true`/`false`, a split the official tree-sitter
  query explicitly contradicts (it groups `true`/`false`/`nil`/`iota` in one
  `@constant.builtin` capture).
- **JSON booleans are orange**, restoring TextMate-Atom and Zed's agreement
  over a One Dark Pro per-language exception (found in the 2026-07
  consistency cleanup, §17).

### 11. Types

- **The type family is yellow, and yellow is only the type family.** Class,
  interface, enum, namespace, struct, type parameters, including Go's builtin
  primitive types (`int`, `string`, `error`): a type is yellow because it is
  a type, not because of how it is spelled. (Go primitives were purple until
  the 2026-07 cleanup, §17.)
- **Zed's type-cyan is legitimate ancestry, not adopted.** Digging through
  the history corrected an earlier conclusion here: cyan types are not a
  base16 template artifact. Tree-sitter-era Atom itself rendered types cyan
  (`type_identifier → support.storage.type`), and Zed's 2023 hand-tune kept
  that deliberately. Yellow and cyan are both Atom ancestry from different
  eras. This theme's stack (TextMate grammars plus a language server) descends
  from the TextMate generation, and the ecosystem survey found types-yellow
  unanimous across all eight implementations, so yellow stands.

### 12. Variables, keys, and parameters

- **The variable family is red**, including `this`/`self`. They are values,
  so they wear variable red, not a special color (§5). An objection from the
  modern tree-sitter ontology (`@variable.builtin` exists as a distinction)
  is on record; we held the identity position. (They wore type-yellow until
  the 2026-07 cleanup, §17.)
- **Dot-receivers and mid-chain properties are ordinary variables.**
  One Dark Pro paints dot-receivers yellow (`variable.other.object`), so the
  same variable changes color depending on whether it precedes a dot. We
  rejected that under the identity principle (§5); `b` in `a.b.c` falls under
  the same decision. What One Dark Pro wanted from that rule, container-like
  things looking yellow, is achieved honestly by the semantic namespace and
  class rules. The resulting TextMate/semantic disagreements are permanent
  `allow.json` entries.
- **The key family is red across formats**: JSON keys, YAML keys, CSS
  property names (the CSS entry closed a hole in the family, with Zed as the
  source), and TOML array keys. A One Dark Pro leftover painted TOML array
  keys type-yellow; it surfaced the moment semantic rules became
  family-named, because "tomlArrayKey: type" reads as wrong in a way
  "#e5c07b" never did. Vendor-prefixed CSS properties (`-webkit-*`) stay
  cyan: vendor prefixes are platform-provided.
- **Parameters are red italic.** The ecosystem survey isolated this as a
  One Dark Pro signature (red is common, the italic is not). We keep it
  deliberately, and record it as taste, not provenance (§6). A Python-only
  parameter color was an exception to the family and was removed in 2026-07
  (§17).

### 13. Embedded boundaries and strings

- **`${}` and embedded punctuation are dark red `#BE5046`**, restored to the
  origin after a mechanical reconciliation of all 78 TextMate-Atom
  assignments.
  Evidence: the origin, base16's 0F slot ("embedded language tags") and every
  Atom-faithful port (akamud, joshdick, Sublime) agree.
  History: tree-sitter-era Atom lost this color (the migration had no brace
  mapping, so this was translation loss, not a decision), and One Dark Pro
  never carried it.
  JSX expression braces carry the same scope and the same meaning, a boundary
  between languages, and are deliberately exempt from the workbench's
  bracket-depth cycling.
- **`variable.interpolation` is dark red**: same family.
- **Regexps are cyan.** One Dark Pro's red was a deliberate 2022 change
  mimicking VS Code Dark+ (issue #678), and mimicking Dark+ is not one of
  this theme's goals. The five-source score was a thin 3-2 (the modern
  generations read regexps as "special strings", orange); the ecosystem
  survey (JetBrains, akamud, Sublime all cyan) widened the margin and closed
  the question.
- **Markdown link URLs are cyan** (origin restoration, same reconciliation
  as `${}`).
- **HTML entities are orange** (Atom and Zed agree across two generations
  against an unexplained 2017 One Dark Pro edit).
- **CSS units are orange.** One Dark Pro's red traced to an external 2018
  bulk PR baked in by a generator rewrite; it was not even the author's
  design.

### 14. Markup

- **Tags red, attributes orange**: near-unanimous across sources and the
  ecosystem (base16 lists "XML Tags" under base08 red). Zed's blue markup
  family is Zed's own design direction and survives only in the retired Zed
  variants (Appendix A).
- **Headings red** (the One Dark tradition, not the cyan of some
  derivatives).

### 15. Shell

- **Command names green, flags (`constant.other.option`) cyan, unquoted
  arguments plain**: the terminal look, matching zsh-syntax-highlighting.
  The green is one of the two accepted exceptions to the family rule (§2);
  it was reviewed in the 2026-07 cleanup and kept.

### 16. Workbench (UI layer)

- **Icon colors stay on VS Code defaults** (2026-08-12). This is a syntax
  theme. We touch the UI layer only when something is genuinely hard to see
  or easy to confuse, never just for consistency with the token vocabulary.
  VS Code's icon palette is legible on the dark workbench, so `symbolIcon.*`
  and the other icon keys are not themed, even though the icons render the
  same classification as tokens.
- **The same bar keeps `scmGraph`'s color-blind-safe palette, charts, and
  merge/diff state colors on defaults.**
- **The 2026 accent remap clears the bar**: upstream's teal collides with
  syntax cyan `#56B6C2`, so the 13-color accent family is recolored to
  `#528BFF` (guarded by the hue-band scan, §8).

### 17. Mistakes we corrected

Conclusions this project got wrong and later fixed in public. They stay here
because re-checking our own decisions is part of the method.

The consistency cleanup (2026-07). Auditing the theme against this very
document found five places where it broke its own rules:

1. Go primitive types purple while TypeScript's were yellow — fixed (§11).
2. `this`/`self` wearing type-yellow — fixed (§12).
3. A per-language exception color for Python parameters — fixed (§12).
4. A per-language exception color for JSON booleans — fixed (§10).
5. Shell command names green — reviewed and kept (§15).

A late echo: four Dart-only semantic exceptions (One Dark Pro leftovers) were
removed once family naming made them visible, the same decision as the
Python-parameter one. The lesson: layer consistency (what the flicker audit
checks) is not family consistency. The former can be satisfied while the
latter is still broken.

Individual corrections:

- "Zed doesn't support LSP semantic highlighting" — outdated; it landed in
  2026-02 as an opt-in. The Zed variants modeled the `"combined"` mode
  (Appendix A).
- "Type-cyan is a base16 template artifact" — half wrong; see §11.
- "One Dark Pro's regexp red was an accident" — it was a deliberate Dark+
  imitation, which changes the reason it was rejected, not the outcome
  (§13).
- "Zed's regexp orange is found nowhere else" — it sides with the modern
  tree-sitter ontology; the cyan decision stands on other grounds (§13).
- A `function.defaultLibrary` cyan "fix" shipped briefly and was reverted:
  the flicker harness showed it introduced flicker rather than removing it
  (§4, §8).
- An all-plain operator scheme shipped briefly and was reverted when daily
  use showed it was wrong (§9).

---

## Part IV — Architecture and operations

### 18. One source of truth, generated everywhere

The built VS Code theme (`themes/*.json`) is the single source of truth for
every platform. The JetBrains `.icls`, Ghostty, Windows Terminal and Vim
artifacts are generated from One Dark 2026 (`scripts/lib.ts`,
`loadBuiltTheme`), so hex parity holds by construction. They keep the
"One Dark Modern" scheme name, which is the extension's identity rather than
a variant label.

- Never hand-edit generated files (`themes/`, `dist/`); CI verifies
  reproducibility.
- The only hand-edited surfaces are `syntax/`, `overrides/` and the decision
  records under `audit/`.

### 19. The syntax layer is owned; the UI layer is diffed

Syntax has no upstream. Since v0.1.0, `syntax/` is this repository's own
source of truth. `families.json` maps the vocabulary of §2 to hex values;
`tokens.json` and `semantic.json` rules reference families by name, so a
color exists in exactly one place, and the build rejects any rule or semantic
entry whose color is outside the vocabulary.

How it was vendored. The rules were vendored from the built theme, with
byte-identical output verified by machine, after One Dark Pro's decade of
grammar tuning had been fully absorbed and every contested rule had been
either confirmed or dropped by the provenance process (§3, §6, Part III).
The v0.1.1 refactor then collapsed the vendored rules from 288 to 14 by
merging same-family rules and deleting dead duplicates, with every step
verified against the real TextMate engine: identical resolution for all
6,762 fixture tokens and all 464 selectors.

The UI layer is a diff. `overrides/` holds only the UI layer's differences
from Dark Modern / 2026 Dark, which remain live upstreams. The test for
keeping an entry: if this were deleted, would the theme's concept be damaged?
If not, defer to upstream. The smaller the overrides, the more the weekly
auto-sync pays off.

### 20. Platform limits

Distinctions a platform cannot express are documented as divergences
(`audit/jetbrains-expected.json`), not fought:

- IntelliJ has no const/readonly key for TypeScript → consts stay red there
- PyCharm has no parameter-specific key → `DEFAULT_PARAMETER` (red italic)
  stands in
- Pylance is closed-source → Python's semantic layer is outside automated
  verification (covered by eye)

### 21. Operations

- Upstream sync. The UI upstreams (Dark Modern, 2026 Dark) sync weekly via a
  PR gated by CI, which then merges and releases itself. Syntax has no
  upstream and never changes via sync. Stopping a sync means closing its PR.
- Maintenance loop. (a) Screenshot a mismatch, (b) adjust `syntax/` or
  `overrides/`, (c) record the decision in Part III.
- Release. Releasing by hand is `npm version patch`; five platform artifacts
  ship automatically either way.

---

## Appendix A. The Zed episode: fidelity as an instrument

For a stretch of v0.0.x this repository also shipped two themes reproducing
Zed's One Dark interpretation verbatim, including the parts this document's
decisions reject (blue markup, cyan types, yellow `nil`). Their contract was
fidelity, not judgment: a mechanical translation of Zed's theme slots and
semantic rule files, verified token by token against real tree-sitter parses
with Zed's own vendored queries (5,000+ captures, zero mismatches), with a
"gap-fills yes, bugs no" rule for what Zed left unspecified. They modeled
Zed's `"combined"` mode once it became clear that Zed does support opt-in
LSP semantic highlighting (§17).

The variants were retired at v0.1.0, but the episode shaped the principles.
Living inside Zed's interpretation surfaced most of the operator, markup and
type-family questions decided in Part III, and the faithful reproduction
worked as a measuring instrument: several "is our color or Zed's correct?"
disputes were settled by having both renderings side by side. Anyone who
wants Zed's interpretation should use Zed's theme in Zed. Reproducing another
editor's judgment is a research tool, not a product.

## Appendix B. Glossary

- One Dark Pro — the VS Code theme whose language rules this repository
  absorbed and then reviewed rule by rule (§6).
- TextMate — the regex-based grammar layer VS Code uses for lexical
  highlighting; it works without a language server (§4).
- Semantic tokens / LSP — role information (variable, type, function)
  supplied by a language server, layered on top of TextMate (§4).
- Flicker — a token whose TextMate color and semantic color disagree, so it
  visibly changes color when the language server starts; the unit of the
  `npm run audit` layering check (§4).
- base16 — Kempson's 16-slot color-scheme standard; its documented slot roles
  make it the reference for meaning disputes (§3).
- Source — one of the five One Dark generations consulted in provenance
  review (§3).
- Family — a named meaning group in `syntax/families.json`, the unit in which
  colors are assigned (§2).
- `allow.json` — the list of accepted TextMate/semantic disagreements, each
  with a reason (§7).
- Dark+ / Dark Modern / 2026 Dark — VS Code's own default dark themes. Dark
  Modern and 2026 Dark supply this theme's workbench UI; Dark+ matters only
  as the thing One Dark Pro once imitated (§13).
- Workbench — VS Code's UI chrome (sidebars, tabs, terminal), as opposed to
  the editor's syntax colors (§1, §16).
