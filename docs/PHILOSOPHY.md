# Design Philosophy

This document explains, to a reader with no prior context, why this theme
colors what it colors — the principles, the evidence system behind them, and
the complete record of contested rulings. Every color decision in the
repository should be derivable from this document; when a new question comes
up, check the rulings here before inventing an answer.

## 1. What this theme is

Four themes are built from one pipeline, expressing two *interpretations* of
One Dark across two *workbench generations*:

| Theme | Syntax interpretation | Workbench |
|---|---|---|
| One Dark Modern | ODP lineage (this document's rulings) | VS Code Dark Modern |
| One Dark 2026 | ODP lineage | VS Code 2026 Dark (accent recolored to `#528BFF`) |
| Zed One Dark Modern | Zed's One Dark, reproduced verbatim | Dark Modern |
| Zed One Dark 2026 | Zed's One Dark, reproduced verbatim | 2026 Dark |

The ODP-lineage themes are the opinionated ones — everything below applies to
them. The Zed variants are governed by a different rule entirely: **fidelity,
not judgment** (§8). Backgrounds always come from the workbench generation,
never from the syntax interpretation.

The identity blend of the ODP-lineage themes: One Dark syntax colors, the
Dark Modern UI (`#181818`/`#1F1F1F`, accent `#0078D4`), and Atom
one-dark-ui's 16-color ANSI terminal palette. This three-way blend *is* the
concept.

## 2. The color vocabulary

Each color maps to a **family of meaning**. Reading a symbol's kind from its
color is the theme's core value; borrowing a color for another family dilutes
the mapping and is forbidden by default.

| Color | Value | Meaning |
|---|---|---|
| Purple | `#C678DD` | Keywords: control flow, storage, and word operators (`func` `if` `const` `import` `new` `typeof` `and`) |
| Blue | `#61AFEF` | Callables (functions, methods, decorators, macros) |
| Yellow | `#E5C07B` | The type family, and nothing else (class/interface/enum/namespace/type parameter) |
| Red | `#E06C75` | The variable family (variables, fields, parameters, `this`/`self`) + key-like names (JSON/YAML keys, CSS property names) + markup tags + headings |
| Cyan | `#56B6C2` | Two families: platform-provided magic (builtins, escapes, regexps, shell flags) and symbol operators (`=` `=>` `&&` `? :`) |
| Green | `#98C379` | Strings, inserted diffs, shell command names |
| Orange | `#D19A66` | The value-constant family: numbers, booleans, `nil`/`null`, named constants, enum members, platform constants (`Math.PI`) — plus attribute names and bold markup |
| Dark red | `#BE5046` | Embedded-world boundaries: `${}` in templates, JSX expression braces, `variable.interpolation` |
| Gray | `#7F848E` | Comments (italic) |
| Foreground | `#ABB2BF` | Punctuation, type-annotation marks — the deliberate choice *not* to highlight |

Two deliberate impurities are canonized:

- Shell command names are green (string color) to mirror
  zsh-syntax-highlighting in terminals.
- Yellow/orange forms a strict two-world split: **yellow is the type world,
  orange is the value world.** A symbol that names a type is yellow even if
  it is builtin (`int`, `string` in Go); a symbol that names a value is
  orange even if it is SCREAMING_CASE.

## 3. Provenance: a color's authority is its history

The central doctrine: **an inherited color's authority is its provenance.**
"It was in One Dark Pro" alone is not a reason once the history is known.
One Dark exists in many implementations that disagree; when they do, the
disagreement is settled by evidence, not by which implementation the theme
happens to descend from.

### The five witnesses

Provenance scoring recognizes five strata of the One Dark family:

1. **TextMate-era Atom** (`atom/one-dark-syntax` before 2018) — the origin.
2. **Tree-sitter-era Atom** (2018 onward) — the same team after the engine
   migration; some colors changed deliberately, others were lost in
   translation (grammar scopes that no longer existed).
3. **base16** (Kempson's 16-slot standard, with base16-onedark) — the only
   witness that documents *roles in writing* ("base09: Integers, Boolean,
   Constants, XML Attributes"), which makes it the dictionary of record for
   what-color-means-what disputes, though it is coarse (16 slots) and not
   authored by the One Dark originators.
4. **Zed** — the Atom team's successor editor. Began as a base16 factory
   (2022), hand-tuned toward Atom fidelity in 2023 (issue #5793). Carries
   real lineage plus its own lone inventions.
5. **Official tree-sitter grammar queries** (snapshotted in
   `audit/provenance/official-treesitter/`) — weighty on *which distinctions
   exist* (is `=>` an operator? is `nil` grouped with `true`?), silent on
   colors, and not inerrant: its vocabulary is uneven across grammars and it
   canonizes heuristics like SCREAMING-case `@constructor`.

Scoring is not mechanical vote-counting. Observed regularities:

- A lone deviation by any single witness is suspect (Zed's blue markup
  tags, ODP's logical-operator cyan carve-out).
- Two-generation agreement (TextMate-Atom + Zed) against ODP usually means
  ODP drifted; such colors were restored to origin.
- When witnesses split cleanly by era (types: yellow in the TextMate
  stratum, cyan in the tree-sitter stratum), both positions are legitimate
  lineage; the theme follows the stratum its own stack descends from.
- A *split no witness makes* is weaker than any witness's position: schemes
  that paint all symbol operators one color are positions; a scheme that
  splits logical operators from the rest is an invention.

### The ecosystem check

Where the five witnesses leave a margin thin, the wider ecosystem serves as
a sixth, advisory source. A survey of eight further implementations
(JetBrains' one-dark plugin, akamud's Atom-generated VS Code port, the
joshdick/navarasu/olimorris Vim/Neovim themes, the Sublime port, two Emacs
themes) is used to detect whether a position is a broad consensus, a
family signature, or an orphan. Findings that changed rulings are recorded
in §6; the survey also confirmed that types-yellow is unanimous across the
entire ecosystem and that the `${}` dark red is carried by every
Atom-faithful port.

## 4. Layering: lexical belongs to TextMate; semantic corrects

- **What cannot be misclassified** (keywords, strings, numbers, comments,
  operators, punctuation) belongs to TextMate. Regexes are sufficient there,
  and TM keeps working before the LSP starts and inside Markdown fences.
- **What can be misclassified** (the role of an identifier: variable? type?
  function?) is corrected by semantic tokens.
- Therefore: **a semantic rule that repaints a color TextMate set
  deliberately is a violation.** Semantic may only fill in tokens TM left at
  the plain foreground, or fix places where TM's own guess is wrong.
- `npm run audit` (real grammars + real LSPs) enforces this mechanically.
  Exceptions exist only in `audit/allow.json`, each with a reason.

Rulings under this principle: the semantic `operator` entry was removed
(rust-analyzer et al. were flattening TM's per-language operator colors);
a `function.defaultLibrary` cyan "fix" turned out to *introduce* flicker and
was reverted after the harness falsified it; the constant/literal merge (§6)
was caught leaving `variable.defaultLibrary` yellow by three new flicker
violations on `JSON`, and the audit forced the fix before release.

## 5. Identity: same symbol, same color

Color attaches to what a symbol **is**, not to **where it is written**.

The defining ruling: One Dark Pro paints dot-receivers yellow
(`variable.other.object`), so the same variable changes color depending on
whether it precedes a dot. This was rejected. Mid-chain properties
(`b` in `a.b.c`) fall under the same ruling. What ODP wanted from that rule
— "container-like things look yellow" — is achieved honestly by semantic
namespace/class rules. The corresponding TM↔semantic disagreements are
permanent `allow.json` entries.

This principle outranks upstream fidelity (§7) when they collide. It also
grounds the `this`/`self` ruling: they are values, so they wear variable
red, not a special color — an objection from the modern tree-sitter
ontology (`@variable.builtin` exists as a distinction) is on record, held
on identity-family grounds.

## 6. The rulings, by token family

The complete record of contested decisions. Dates are retained because
several rulings supersede earlier ones.

### Operators

- **Symbol operators are cyan `#56B6C2`, in every language** (2026-07-20).
  History of the position: TextMate-era Atom purpled all operators; late
  Atom left all plain; Zed cyans all; base16 files operators under base05
  (foreground); ODP shipped a mix (logical operators cyan, ternary/optional
  purple via a word-operator group, arrow purple, rest plain). The mixes
  failed provenance review — no witness splits the operator family — and
  were shed in one sweep. A doctrinally-pure all-plain remedy shipped
  first and was overruled on sight the same day: washed-out operators
  failed the living-with-it test, and the all-cyan Zed position was adopted
  instead. The ecosystem survey later showed cyan is one of three viable
  camps (plain/cyan/purple), shared with akamud and One Dark Pro.nvim.
- **`=>` is an operator, not a keyword** (2026-07-20). The purple arrow
  (TextMate-Atom + ODP) lost to the modern witnesses: official tree-sitter
  lists `"=>"` in the same `@operator` capture as every other symbol.
- **Word operators stay purple**: `new`, `typeof`, `instanceof`, `in`,
  `of`, `delete`, `void`, Python's `and/or/not`. Words are keywords,
  symbols are operators; each family is internally uniform.
- **Type-world marks stay plain**: annotation `:`, optional `?`, union
  `|`. Zed paints these dark red (`punctuation.special`) — a lone Zed
  invention, not imported.
- **Go's operators are one cyan family** (`:=` `+` `*` `&` `&&` `==`).
  ODP's Go quirks (`:=` yellow from a 2018 no-reason commit,
  pointer-purple from a 2020 bug-report patch) were shed; when the
  generic operator ruling later threatened to strand Go's `&&` on plain,
  a `.go`-scoped entry kept the family whole.

### Constants and literals

- **Named constants merged into the orange value family** (2026-07-20):
  `const` locals, SCREAMING constants, enum members, and platform
  constants (`Math.PI`, `JSON`) all wear `#D19A66`, same as numbers and
  booleans. The previous yellow split was an ODP-lineage signature no
  other One Dark family shares (the ecosystem's few splitters use cyan or
  violet); base16 files constants and literals together under base09.
  After this merge, yellow means exactly one thing: the type family.
- **`nil`/`null`/`None` are orange** — they are literals. Zed's yellow
  `nil` is doubly isolated: no other implementation uses yellow, and
  Zed's own query splits `nil` from `true`/`false` — a split the official
  tree-sitter query explicitly contradicts (it groups
  `true`/`false`/`nil`/`iota` in one `@constant.builtin` capture).
- **JSON booleans orange** (restores TextMate-Atom + Zed agreement over an
  ODP per-language exception).

### Types

- **The type family is yellow, and yellow is only the type family.**
  Class, interface, enum, namespace, struct, type parameters — including
  Go's builtin primitive types (`int`, `string`, `error`): a type is
  yellow because it is a type, not because of how it is spelled.
- **Zed's type-cyan is legitimate lineage, not adopted.** Deep archaeology
  corrected an earlier verdict here: cyan types are not a base16 factory
  artifact — tree-sitter-era Atom itself rendered types cyan
  (`type_identifier → support.storage.type`), and Zed's 2023 hand-tune
  deliberately kept that. Yellow and cyan are both Atom ancestry from
  different eras. This theme's stack (TextMate grammars + LSP) descends
  from the TextMate stratum, and the ecosystem survey found types-yellow
  unanimous across all eight implementations, so yellow stands.

### Variables, keys, and parameters

- **The variable family is red**, including `this`/`self` (§5).
- **The key family is red across formats**: JSON keys, YAML keys, and CSS
  property names (the CSS entry closed a hole in the family, with Zed as
  witness). Vendor-prefixed CSS properties (`-webkit-*`) stay cyan:
  vendor prefixes are platform magic.
- **Parameters are red italic.** The ecosystem survey isolated this as an
  ODP signature (red is common; the italic is not). Kept deliberately as
  a signature — recorded as taste, not provenance.

### Embedded boundaries and strings

- **`${}` and embedded punctuation are dark red `#BE5046`** — restored to
  origin after a mechanical reconciliation of all 78 TextMate-Atom
  assignments. Tree-sitter-era Atom *lost* this color (the migration had
  no brace mapping — translation loss, not a decision), ODP never carried
  it, but origin + base16's 0F slot ("embedded language tags") + every
  Atom-faithful port (akamud, joshdick, Sublime) agree. JSX expression
  braces carry the same scope and the same meaning: a boundary between
  worlds, deliberately exempt from the workbench's bracket-depth cycling.
- **`variable.interpolation` dark red** — same family.
- **Regexps are cyan.** ODP's red was a deliberate 2022 change mimicking
  VS Code Dark+ (issue #678) — mimicking Dark+ is not one of this theme's
  principles. The five-witness score was a thin 3-2 (the modern strata
  read regexps as "special strings", orange); the ecosystem survey
  (JetBrains, akamud, Sublime all cyan) widened the margin and closed the
  question.
- **Markdown link URLs cyan** (origin restoration, same reconciliation as
  `${}`).
- **HTML entities orange** (Atom+Zed two-generation agreement over an
  unexplained 2017 ODP edit). **CSS units orange** (ODP's red traced to an
  external 2018 bulk PR baked in by a generator rewrite — not even the
  author's design).

### Markup

- **Tags red, attributes orange** — near-unanimous across witnesses and
  ecosystem (base16 lists "XML Tags" under base08 red). Zed's blue markup
  family is a lone philosophy axis, preserved in the Zed variants only.
- **Headings red** (One Dark tradition, not the cyan of some derivatives).

### Shell

- Command names green, flags (`constant.other.option`) cyan, unquoted
  arguments plain — the terminal-calibrated look, matching
  zsh-syntax-highlighting.

### Corrections record

Verdicts this project got wrong and later fixed in public — kept here
because re-checking your own rulings is part of the method:

- "Zed doesn't support LSP semantic highlighting" — outdated; it landed
  2026-02, opt-in. The Zed variants now model the `"combined"` mode.
- "Type-cyan is a base16 template artifact" — half wrong; see Types.
- "ODP's regexp red was an accident" — it was a deliberate Dark+ mimicry,
  which changes the reason it was rejected, not the outcome.
- "Zed's regexp orange is an orphan" — it sides with the modern
  tree-sitter ontology; the cyan ruling stands on other grounds.
- A `function.defaultLibrary` cyan fix and an all-plain operator scheme
  both shipped briefly and were reverted when measurement (the former)
  and daily use (the latter) falsified them.

## 7. Upstream pragmatism (no purism)

A faithful rebuild from `atom/one-dark-syntax` was tried once and rejected:
gray parameters, foreground operators and dark comments did not survive
daily use. One Dark Pro's ~150 language-specific rules are a decade of
tuning against real grammars — valuable, but **ODP is a reviewed
dependency, not canon**: it is synced automatically, and its rules stand
only until provenance review finds one with a weak pedigree (§3, §6).

The yardstick for taste calls is eyes calibrated by years of daily use of
this lineage. Two consequences are recorded honestly: the theme keeps two
ODP signatures on taste (parameter italic; and it inherited the
constants-yellow signature for a long time before evidence retired it),
and it once rejected a doctrinally-correct scheme (all-plain operators)
because it looked wrong in practice. Provenance proposes; daily use
disposes.

A self-consistency purge (2026-07) is part of this record: auditing the
theme against this very document found five self-violations (Go primitive
types purple while TS's were yellow; `this`/`self` wearing type-yellow;
per-language exception colors for Python parameters and JSON booleans;
enum members cyan while consts were yellow). Four were fixed; the
shell-green exception was reviewed and kept. Lesson: layer consistency
(what the flicker audit checks) is not family consistency — the former
can be satisfied while canonizing the latter's violation.

## 8. The Zed variants: fidelity, not judgment

The Zed-interpretation themes exist to reproduce Zed's One Dark exactly —
including the parts this document's rulings reject (blue markup, cyan
types, yellow `nil`, dark-red type marks). Their contract:

- Syntax colors are a mechanical translation of Zed's theme slots and
  semantic rule files, verified token-by-token against real tree-sitter
  parses with Zed's own vendored queries (5,000+ captures, zero
  mismatches; permanent constraints in `audit/zed-allow.json`).
- **Gap-fills yes, bugs no**: where Zed ships no rule (TS semantic rules),
  the variant fills the gap in Zed's spirit; where Zed's output is
  arguably a bug, it is reproduced anyway and noted.
- Repainting a Zed color to this document's preference would make the
  variant a fifth theme instead of a faithful instrument; it is off the
  table.
- Workbench surfaces are the exception: backgrounds and selection colors
  come from the UI generation (§1), with element-color overrides guarding
  against VS Code's legacy blue defaults.

## 9. One source of truth, generated everywhere

**The built VS Code theme (`themes/*.json`) is the single source of truth
for every platform.** The JetBrains `.icls`, Ghostty, Windows Terminal and
Vim artifacts are generated from it, so hex parity holds by construction.

- Never hand-edit generated files (`themes/`, `dist/`); CI verifies
  reproducibility.
- The only hand-edited surfaces are `overrides/` and the judgment records
  under `audit/`.

## 10. Overrides are the complete list of intent

`overrides/` holds only what this theme **deliberately** does differently
from its upstreams (Dark Modern / 2026 Dark / ODP / Zed). The test for
keeping an entry: *"if this were deleted, would the theme's concept be
damaged?"* If not, defer to upstream — the smaller the overrides, the more
the weekly auto-sync pays off. (Early cleanup deleted 15 entries that
accidentally pinned stale upstream values and 5 leftovers from the atom
experiment.)

## 11. Decisions are data

The *why* behind a color lives in machine-readable places with reasons,
not in chat logs or commit messages:

- `audit/allow.json` — where semantic may override TM, and why
- `audit/zed-allow.json` — permanent constraints of the Zed reproduction
- `audit/jetbrains-expected.json` — colors guaranteed in the real IDEs,
  and documented divergences
- this document — principles and rulings

Together they form the precedent record. Changes should be checked against
precedent first.

## 12. Measure, don't assume

Colors are verified against **real engines**, not knowledge, mapping
tables or corpora:

- VS Code: `vscode-textmate` + gopls / typescript-language-server
  (`npm run audit`)
- Zed variants: web-tree-sitter with Zed's vendored queries
  (`npm run audit:zed`)
- JetBrains: headless GoLand / WebStorm dumping actual token attribute
  keys with fallback chains (`jetbrains-audit/`)
- 2026 accent: a hue-band scan guards the 13-color accent family remap

Evidence from this repo's history: a careful manual audit misjudged the
builtin color; a theme-corpus check missed the real key
`GO_LOCAL_VARIABLE`; a plausible semantic "fix" was falsified by the
harness before it shipped; a doctrine change (constant merge) tripped
three flicker violations that located the one rule the sweep had missed.
**Every bug class that happened once gets a machine guard.**

## 13. Accept platform vocabulary limits

Distinctions a platform cannot express are documented as divergences, not
fought:

- IntelliJ has no const/readonly key for TS → consts stay red there
- PyCharm has no parameter-specific key → `DEFAULT_PARAMETER` (red italic)
  stands in
- Pylance is closed-source → Python's semantic layer is outside automated
  verification (covered by eyeballs)

Invest in verification proportionally to **how much intelligence sits
between the theme and the pixels**: IntelliJ > VS Code > Zed queries >
Vim > terminals (passive palettes; generation correctness is all there is
to check).

## Operations

- Upstreams (Dark Modern, 2026 Dark, ODP, Zed theme + queries + semantic
  rules) sync weekly via an auto-merge PR gated by CI; ODP content changes
  are excluded from auto-merge and flagged for provenance review instead.
- The maintenance loop is: (a) screenshot a mismatch, (b) add one entry to
  `overrides/`, (c) record the ruling here.
- Releasing is `npm version patch` — five platform artifacts ship
  automatically.
