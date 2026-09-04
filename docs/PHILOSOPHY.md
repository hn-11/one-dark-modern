# Design Philosophy

> 日本語版: [PHILOSOPHY.ja.md](PHILOSOPHY.ja.md)

This document explains, to a reader with no prior context, why this theme
colors what it colors. Every color decision in the repository should be
derivable from it; when a new question comes up, check the rulings here
before inventing an answer.

It is organized in four parts:

- **Part I — What the theme is** (§1–2): identity and the color vocabulary.
- **Part II — How decisions are made** (§3–8): the principles that every
  ruling is argued from.
- **Part III — The rulings** (§9–17): the complete record of contested
  decisions, by token family, plus the corrections record.
- **Part IV — Architecture and operations** (§18–21): where the colors live,
  how they are generated and verified, and how the repository is maintained.

Two appendices hold the Zed episode (A) and a glossary (B). Abbreviations
used throughout — ODP, TM, LSP, base16, flicker — are defined in the
glossary.

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

The identity blend: this repository's One Dark syntax colors, the
Dark Modern UI (`#181818`/`#1F1F1F`, accent `#0078D4`), and Atom
one-dark-ui's 16-color ANSI terminal palette. This three-way blend *is* the
concept.

(Two further themes reproducing Zed's One Dark interpretation verbatim
shipped between v0.0.x releases and were retired at v0.1.0; see Appendix A.)

### 2. The color vocabulary

Each color maps to a **family of meaning**. Reading a symbol's kind from its
color is the theme's core value; borrowing a color for another family dilutes
the mapping and is forbidden by default.

The families below are the ones in `syntax/families.json`; every rule in
`syntax/tokens.json` and `syntax/semantic.json` names one of them, and the
build rejects any other color (§19). The table is therefore the executable
vocabulary, not just documentation.

| Family | Color | Value | What it covers |
|---|---|---|---|
| `keyword` | Purple | `#C678DD` | Control flow, storage, and word operators (`func` `if` `const` `import` `new` `typeof` `and`) |
| `callable` | Blue | `#61AFEF` | Functions, methods, decorators, macros |
| `type` | Yellow | `#E5C07B` | The type family, and nothing else: class, interface, enum, namespace, struct, type parameter |
| `variable-and-key` | Red | `#E06C75` | The variable family (variables, fields, parameters, `this`/`self`); key-like names (JSON/YAML keys, CSS property names); markup tags; headings |
| `platform-and-operator` | Cyan | `#56B6C2` | Platform-provided magic (builtins, escapes, regexps, shell flags) and symbol operators (`=` `=>` `&&` `? :`) |
| `string` | Green | `#98C379` | Strings, inserted diffs, shell command names |
| `value-constant` | Orange | `#D19A66` | Numbers, booleans, `nil`/`null`, named constants, enum members, platform constants (`Math.PI`); also attribute names and bold markup |
| `embedded-boundary` | Dark red | `#BE5046` | Boundaries between worlds: `${}` in templates, JSX expression braces, `variable.interpolation` |
| `comment` | Gray | `#7F848E` | Comments (italic) |
| `comment-dim` | Dim gray | `#5C6370` | Links inside comments, Markdown block quotes |
| `plain` | Foreground | `#ABB2BF` | Punctuation, type-annotation marks — the deliberate choice *not* to highlight |
| `invalid` | Error red | `#F44747` | Illegal, broken, deprecated and unimplemented tokens |

A pseudo-family `style-only` carries font style without a color (parameter
italic, JS/TS attribute italic, Markdown italic and underline).

Two deliberate impurities are canonized:

- Shell command names are green (string color) to mirror
  zsh-syntax-highlighting in terminals (§15).
- Yellow/orange forms a strict two-world split: **yellow is the type world,
  orange is the value world.** A symbol that names a type is yellow even if
  it is builtin (`int`, `string` in Go); a symbol that names a value is
  orange even if it is SCREAMING_CASE (§10, §11).

---

## Part II — How decisions are made

### 3. Provenance: a color's authority is its history

The central doctrine: **an inherited color's authority is its provenance.**
"It was in One Dark Pro" alone is not a reason once the history is known.
One Dark exists in many implementations that disagree; when they do, the
disagreement is settled by evidence, not by which implementation the theme
happens to descend from.

#### The five witnesses

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

#### How the witnesses are weighed

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

#### The ecosystem check

Where the five witnesses leave a margin thin, the wider ecosystem serves as
a sixth, advisory source. A survey of eight further implementations
(JetBrains' one-dark plugin, akamud's Atom-generated VS Code port, the
joshdick/navarasu/olimorris Vim/Neovim themes, the Sublime port, two Emacs
themes) is used to detect whether a position is a broad consensus, a
family signature, or an orphan. Findings that changed rulings are recorded
in Part III; the survey also confirmed that types-yellow is unanimous
across the entire ecosystem and that the `${}` dark red is carried by every
Atom-faithful port.

### 4. Layering: lexical belongs to TextMate; semantic corrects

- **What cannot be misclassified** (keywords, strings, numbers, comments,
  operators, punctuation) belongs to TextMate. Regexes are sufficient there,
  and TM keeps working before the LSP starts and inside Markdown fences.
- **What can be misclassified** (the role of an identifier: variable? type?
  function?) is corrected by semantic tokens.
- Therefore: **a semantic rule that repaints a color TextMate set
  deliberately is a violation.** Semantic may only fill in tokens TM left at
  the plain foreground, or fix places where TM's own guess is wrong.
- `npm run audit` (real grammars + real LSPs) enforces this mechanically:
  a TM↔semantic disagreement is a *flicker* violation. Exceptions exist
  only in `audit/allow.json`, each with a reason.

Rulings argued from this principle: the removal of the semantic `operator`
entry (§9), the reverted `function.defaultLibrary` fix (§17), and the
flicker violations that completed the constant merge (§10).

### 5. Identity: same symbol, same color

Color attaches to what a symbol **is**, not to **where it is written**.

The defining case is One Dark Pro's yellow dot-receiver, under which the
same variable changes color depending on whether it precedes a dot; it was
rejected (§12). The principle also grounds the `this`/`self` ruling: they
are values, so they wear variable red, not a special color (§12).

This principle outranks upstream fidelity (§6) when they collide.

### 6. Upstream pragmatism (no purism)

A faithful rebuild from `atom/one-dark-syntax` was tried once and rejected:
gray parameters, foreground operators and dark comments did not survive
daily use. One Dark Pro's ~150 language-specific rules are a decade of
tuning against real grammars — valuable, but **ODP is a reviewed
dependency, not canon**. Its rules stood only until provenance review found
one with a weak pedigree (§3, Part III). ODP thereby completed a demotion
arc: canon → reviewed dependency → reference. Since v0.1.0 its changes are
not synced (§19); anything worth importing arrives the same way any other
witness's position does — through a ruling.

The yardstick for taste calls is eyes calibrated by years of daily use of
this lineage. Two consequences are recorded honestly: the theme keeps two
ODP signatures on taste (parameter italic, §12; and it inherited the
constants-yellow signature for a long time before evidence retired it,
§10), and it once rejected a doctrinally-correct scheme (all-plain
operators, §9) because it looked wrong in practice. **Provenance proposes;
daily use disposes.**

### 7. Decisions are data

The *why* behind a color lives in machine-readable places with reasons,
not in chat logs or commit messages:

- `audit/allow.json` — where semantic may override TM, and why
- `audit/jetbrains-expected.json` — colors guaranteed in the real IDEs,
  and documented divergences
- this document — principles and rulings

Together they form the precedent record. Changes should be checked against
precedent first.

### 8. Measure, don't assume

Colors are verified against **real engines**, not knowledge, mapping
tables or corpora:

- VS Code: `vscode-textmate` + gopls / typescript-language-server
  (`npm run audit`)
- JetBrains: headless GoLand / WebStorm dumping actual token attribute
  keys with fallback chains (`jetbrains-audit/`)
- 2026 accent: a hue-band scan guards the 13-color accent family remap

Evidence from this repo's history that assumptions fail: a careful manual
audit misjudged the builtin color; a theme-corpus check missed the real key
`GO_LOCAL_VARIABLE`; a plausible semantic "fix" was falsified by the
harness before it shipped (§17); a doctrine change tripped three flicker
violations that located the one rule the sweep had missed (§10).
**Every bug class that happened once gets a machine guard.**

Invest in verification proportionally to **how much intelligence sits
between the theme and the pixels**: IntelliJ > VS Code > Vim > terminals
(passive palettes; generation correctness is all there is to check).

---

## Part III — The rulings

The complete record of contested decisions, by token family. Each entry
states the **ruling** first, then the evidence and the history behind it.
Dates are retained where known, because several rulings supersede earlier
ones.

### 9. Operators

**Symbol operators are cyan `#56B6C2`, in every language** (2026-07-20).

- *Evidence:* no witness splits the operator family. TextMate-era Atom
  purpled all operators; late Atom left all plain; Zed cyans all; base16
  files operators under base05 (foreground). The ecosystem survey later
  showed cyan is one of three viable camps (plain/cyan/purple), shared with
  akamud and One Dark Pro.nvim.
- *History:* ODP shipped a mix (logical operators cyan, ternary/optional
  purple via a word-operator group, arrow purple, rest plain). The mixes
  failed provenance review and were shed in one sweep. A doctrinally-pure
  all-plain remedy shipped first and was overruled on sight the same day:
  washed-out operators failed the living-with-it test, and the all-cyan
  Zed position was adopted instead.

**`=>` is an operator, not a keyword** (2026-07-20). The purple arrow
(TextMate-Atom + ODP) lost to the modern witnesses: official tree-sitter
lists `"=>"` in the same `@operator` capture as every other symbol.

**Word operators stay purple**: `new`, `typeof`, `instanceof`, `in`, `of`,
`delete`, `void`, Python's `and/or/not`. Words are keywords, symbols are
operators; each family is internally uniform.

**Type-world marks stay plain**: annotation `:`, optional `?`, union `|`.
Zed paints these dark red (`punctuation.special`) — a lone Zed invention,
not imported.

**Go's operators are one cyan family** (`:=` `+` `*` `&` `&&` `==`). ODP's
Go quirks (`:=` yellow from a 2018 no-reason commit, pointer-purple from a
2020 bug-report patch) were shed; when the generic operator ruling later
threatened to strand Go's `&&` on plain, a `.go`-scoped entry kept the
family whole.

**No semantic `operator` entry.** rust-analyzer and other servers were
flattening TM's per-language operator colors; the entry was removed under
the layering principle (§4).

### 10. Constants and literals

**Named constants merged into the orange value family** (2026-07-20):
`const` locals, SCREAMING constants, enum members, and platform constants
(`Math.PI`, `JSON`) all wear `#D19A66`, same as numbers and booleans. After
this merge, yellow means exactly one thing: the type family.

- *Evidence:* the previous yellow split was an ODP-lineage signature no
  other One Dark family shares (the ecosystem's few splitters use cyan or
  violet); base16 files constants and literals together under base09.
- *History:* the merge initially left `variable.defaultLibrary` yellow.
  Three new flicker violations on `JSON` caught it, and the audit forced
  the fix before release — the doctrine change located the one rule the
  sweep had missed.

**`nil`/`null`/`None` are orange** — they are literals. Zed's yellow `nil`
is doubly isolated: no other implementation uses yellow, and Zed's own
query splits `nil` from `true`/`false` — a split the official tree-sitter
query explicitly contradicts (it groups `true`/`false`/`nil`/`iota` in one
`@constant.builtin` capture).

**JSON booleans orange** — restores TextMate-Atom + Zed agreement over an
ODP per-language exception (found in the 2026-07 self-consistency purge,
§17).

### 11. Types

**The type family is yellow, and yellow is only the type family.** Class,
interface, enum, namespace, struct, type parameters — including Go's builtin
primitive types (`int`, `string`, `error`): a type is yellow because it is a
type, not because of how it is spelled. (Go primitives were purple until the
2026-07 purge, §17.)

**Zed's type-cyan is legitimate lineage, not adopted.** Deep archaeology
corrected an earlier verdict here: cyan types are not a base16 factory
artifact — tree-sitter-era Atom itself rendered types cyan
(`type_identifier → support.storage.type`), and Zed's 2023 hand-tune
deliberately kept that. Yellow and cyan are both Atom ancestry from
different eras. This theme's stack (TextMate grammars + LSP) descends from
the TextMate stratum, and the ecosystem survey found types-yellow unanimous
across all eight implementations, so yellow stands.

### 12. Variables, keys, and parameters

**The variable family is red**, including `this`/`self`. They are values,
so they wear variable red, not a special color (§5). An objection from the
modern tree-sitter ontology (`@variable.builtin` exists as a distinction)
is on record, held on identity-family grounds. (They wore type-yellow until
the 2026-07 purge, §17.)

**Dot-receivers and mid-chain properties are ordinary variables.** One Dark
Pro paints dot-receivers yellow (`variable.other.object`), so the same
variable changes color depending on whether it precedes a dot. This was
rejected under the identity principle (§5); `b` in `a.b.c` falls under the
same ruling. What ODP wanted from that rule — "container-like things look
yellow" — is achieved honestly by semantic namespace/class rules. The
corresponding TM↔semantic disagreements are permanent `allow.json` entries.

**The key family is red across formats**: JSON keys, YAML keys, CSS
property names (the CSS entry closed a hole in the family, with Zed as
witness), and TOML array keys (an ODP leftover painted them type-yellow;
the fossil surfaced the moment semantic rules became family-named —
"tomlArrayKey: type" reads as wrong in a way "#e5c07b" never did).
Vendor-prefixed CSS properties (`-webkit-*`) stay cyan: vendor prefixes are
platform magic.

**Parameters are red italic.** The ecosystem survey isolated this as an ODP
signature (red is common; the italic is not). Kept deliberately as a
signature — recorded as taste, not provenance (§6). A Python-only
parameter color was an exception to the family and was purged in 2026-07
(§17).

### 13. Embedded boundaries and strings

**`${}` and embedded punctuation are dark red `#BE5046`** — restored to
origin after a mechanical reconciliation of all 78 TextMate-Atom
assignments.

- *Evidence:* origin + base16's 0F slot ("embedded language tags") + every
  Atom-faithful port (akamud, joshdick, Sublime) agree.
- *History:* tree-sitter-era Atom *lost* this color (the migration had no
  brace mapping — translation loss, not a decision), and ODP never carried
  it.
- JSX expression braces carry the same scope and the same meaning: a
  boundary between worlds, deliberately exempt from the workbench's
  bracket-depth cycling.

**`variable.interpolation` dark red** — same family.

**Regexps are cyan.** ODP's red was a deliberate 2022 change mimicking
VS Code Dark+ (issue #678) — mimicking Dark+ is not one of this theme's
principles. The five-witness score was a thin 3-2 (the modern strata read
regexps as "special strings", orange); the ecosystem survey (JetBrains,
akamud, Sublime all cyan) widened the margin and closed the question.

**Markdown link URLs cyan** (origin restoration, same reconciliation as
`${}`).

**HTML entities orange** (Atom+Zed two-generation agreement over an
unexplained 2017 ODP edit).

**CSS units orange** (ODP's red traced to an external 2018 bulk PR baked in
by a generator rewrite — not even the author's design).

### 14. Markup

**Tags red, attributes orange** — near-unanimous across witnesses and
ecosystem (base16 lists "XML Tags" under base08 red). Zed's blue markup
family is a lone philosophy axis, kept only in the retired Zed variants
(Appendix A).

**Headings red** (One Dark tradition, not the cyan of some derivatives).

### 15. Shell

**Command names green, flags (`constant.other.option`) cyan, unquoted
arguments plain** — the terminal-calibrated look, matching
zsh-syntax-highlighting. The green is one of the two canonized impurities
(§2); it was reviewed in the 2026-07 purge and kept.

### 16. Workbench (UI layer)

**Icon colors stay on VS Code defaults** (2026-08-12). This is a syntax
theme: the UI layer is touched only when something is genuinely hard to see
or confusable, never for consistency with the token vocabulary alone.
VS Code's icon palette is legible on the dark workbench, so `symbolIcon.*`
and the other icon keys are not themed — even though the icons render the
same classification as tokens.

**The same bar keeps `scmGraph`'s color-blind-safe palette, charts, and
merge/diff state colors on defaults.**

**The 2026 accent remap clears the bar**: upstream's teal collides with
syntax cyan `#56B6C2`, so the 13-color accent family is recolored to
`#528BFF` (guarded by the hue-band scan, §8).

### 17. Corrections record

Verdicts this project got wrong and later fixed in public — kept here
because re-checking your own rulings is part of the method.

**The self-consistency purge (2026-07).** Auditing the theme against this
very document found five self-violations:

1. Go primitive types purple while TS's were yellow — fixed (§11).
2. `this`/`self` wearing type-yellow — fixed (§12).
3. A per-language exception color for Python parameters — fixed (§12).
4. A per-language exception color for JSON booleans — fixed (§10).
5. Shell command names green — reviewed and kept (§15).

A late echo: four Dart-only semantic exceptions (ODP leftovers) were purged
once family-naming made them visible — the same decision as the
Python-parameter purge. Lesson: layer consistency (what the flicker audit
checks) is not family consistency — the former can be satisfied while
canonizing the latter's violation.

**Individual corrections:**

- "Zed doesn't support LSP semantic highlighting" — outdated; it landed
  2026-02, opt-in. The Zed variants modeled the `"combined"` mode
  (Appendix A).
- "Type-cyan is a base16 template artifact" — half wrong; see §11.
- "ODP's regexp red was an accident" — it was a deliberate Dark+ mimicry,
  which changes the reason it was rejected, not the outcome (§13).
- "Zed's regexp orange is an orphan" — it sides with the modern tree-sitter
  ontology; the cyan ruling stands on other grounds (§13).
- A `function.defaultLibrary` cyan "fix" shipped briefly and was reverted:
  the flicker harness showed it *introduced* flicker rather than removing
  it (§4, §8).
- An all-plain operator scheme shipped briefly and was reverted when daily
  use falsified it (§9).

---

## Part IV — Architecture and operations

### 18. One source of truth, generated everywhere

**The built VS Code theme (`themes/*.json`) is the single source of truth
for every platform.** The JetBrains `.icls`, Ghostty, Windows Terminal and
Vim artifacts are generated from One Dark 2026 (`scripts/lib.ts`,
`loadBuiltTheme`), so hex parity holds by construction. They keep the
"One Dark Modern" scheme name, which is the extension's identity rather
than a variant label.

- Never hand-edit generated files (`themes/`, `dist/`); CI verifies
  reproducibility.
- The only hand-edited surfaces are `syntax/`, `overrides/` and the
  judgment records under `audit/`.

### 19. The syntax layer is owned; the UI layer is diffed

**Syntax has no upstream.** Since v0.1.0, `syntax/` is this repository's
own source of truth. `families.json` maps the vocabulary of §2 to hex
values; `tokens.json` and `semantic.json` rules reference families by name,
so a color exists in exactly one place, and the build rejects any rule or
semantic entry whose color is outside the vocabulary.

**How it was vendored.** The rules were vendored from the built theme —
byte-identical output, machine-verified — after One Dark Pro's decade of
grammar tuning had been fully absorbed and its every contested rule either
ratified or shed by the provenance process (§3, §6, Part III). The v0.1.1
refactor then collapsed the vendored rules from 288 to 14 by merging
same-family rules and deleting dead duplicates, every step verified against
the real TextMate engine: identical resolution for all 6,762 fixture tokens
and all 464 selectors.

**The UI layer is a diff.** `overrides/` holds only the UI layer's diffs
against Dark Modern / 2026 Dark, which remain live upstreams. The test for
keeping an entry: *"if this were deleted, would the theme's concept be
damaged?"* If not, defer to upstream — the smaller the overrides, the more
the weekly auto-sync pays off.

### 20. Accept platform vocabulary limits

Distinctions a platform cannot express are documented as divergences
(`audit/jetbrains-expected.json`), not fought:

- IntelliJ has no const/readonly key for TS → consts stay red there
- PyCharm has no parameter-specific key → `DEFAULT_PARAMETER` (red italic)
  stands in
- Pylance is closed-source → Python's semantic layer is outside automated
  verification (covered by eyeballs)

### 21. Operations

- **Upstream sync.** The UI upstreams (Dark Modern, 2026 Dark) sync weekly
  via a PR gated by CI, which then merges and releases itself. Syntax has
  no upstream and never changes via sync. Stopping a sync means closing its
  PR.
- **Maintenance loop.** (a) Screenshot a mismatch, (b) adjust `syntax/` or
  `overrides/`, (c) record the ruling in Part III.
- **Release.** Releasing by hand is `npm version patch` — five platform
  artifacts ship automatically either way.

---

## Appendix A. The Zed episode: fidelity as an instrument

For a stretch of v0.0.x this repository also shipped two themes reproducing
Zed's One Dark interpretation verbatim — including the parts this
document's rulings reject (blue markup, cyan types, yellow `nil`). Their
contract was **fidelity, not judgment**: a mechanical translation of Zed's
theme slots and semantic rule files, verified token-by-token against real
tree-sitter parses with Zed's own vendored queries (5,000+ captures, zero
mismatches), with a "gap-fills yes, bugs no" rule for what Zed left
unspecified. They modeled Zed's `"combined"` mode once it became clear that
Zed does support opt-in LSP semantic highlighting (§17).

The variants were retired at v0.1.0, but the episode shaped the doctrine:
living inside Zed's interpretation surfaced most of the operator, markup
and type-family questions ruled on in Part III, and the faithful
reproduction served as a measuring instrument — several "is our color or
Zed's correct?" disputes were settled by having both renderings side by
side. Anyone who wants Zed's interpretation should use Zed's theme in Zed;
reproducing another editor's judgment is a research tool, not a product.

## Appendix B. Glossary

- **ODP** — One Dark Pro, the VS Code theme whose language rules this
  repository absorbed and then reviewed rule by rule (§6).
- **TM / TextMate** — the regex-based grammar layer VS Code uses for
  lexical highlighting; works without a language server (§4).
- **Semantic tokens / LSP** — role information (variable, type, function)
  supplied by a language server, layered on top of TM (§4).
- **Flicker** — a token whose TM color and semantic color disagree, so it
  visibly changes color when the language server starts; the unit of the
  `npm run audit` layering check (§4).
- **base16** — Kempson's 16-slot color-scheme standard; its documented slot
  roles make it the dictionary of record for meaning disputes (§3).
- **Witness** — one of the five One Dark strata consulted in provenance
  scoring (§3).
- **Family** — a named meaning group in `syntax/families.json`, the unit
  in which colors are assigned (§2).
- **`allow.json`** — the list of sanctioned TM↔semantic disagreements, each
  with a reason (§7).
- **Dark+ / Dark Modern / 2026 Dark** — VS Code's own default dark themes;
  Dark Modern and 2026 Dark supply this theme's workbench UI, Dark+ is
  only relevant as the thing ODP once mimicked (§13).
- **Workbench** — VS Code's UI chrome (sidebars, tabs, terminal), as
  opposed to the editor's syntax colors (§1, §16).
