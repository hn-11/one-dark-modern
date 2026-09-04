# Decisions

> 日本語版: [DECISIONS.ja.md](DECISIONS.ja.md)

The record of contested color decisions, by token family, plus the mistakes
we corrected. Each entry states the decision first, then the evidence and
the history behind it. Dates are kept where known, because several
decisions replace earlier ones.

The principles these decisions are argued from are in
[PHILOSOPHY.md](PHILOSOPHY.md); references like "Philosophy §4" point
there. When a change settles a new question, add it here.

## 1. Operators

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
  removed under the layering principle (Philosophy §5).

## 2. Constants and literals

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
  consistency cleanup, §9).

## 3. Types

- **The type family is yellow, and yellow is only the type family.** Class,
  interface, enum, namespace, struct, type parameters, including Go's builtin
  primitive types (`int`, `string`, `error`): a type is yellow because it is
  a type, not because of how it is spelled. (Go primitives were purple until
  the 2026-07 cleanup, §9.)
- **Zed's type-cyan is legitimate ancestry, not adopted.** Digging through
  the history corrected an earlier conclusion here: cyan types are not a
  base16 template artifact. Tree-sitter-era Atom itself rendered types cyan
  (`type_identifier → support.storage.type`), and Zed's 2023 hand-tune kept
  that deliberately. Yellow and cyan are both Atom ancestry from different
  eras. This theme's stack (TextMate grammars plus a language server) descends
  from the TextMate generation, and the ecosystem survey found types-yellow
  unanimous across all eight implementations, so yellow stands.

## 4. Variables, keys, and parameters

- **The variable family is red**, including `this`/`self`. They are values,
  so they wear variable red, not a special color (Philosophy §6). An
  objection from the modern tree-sitter ontology (`@variable.builtin` exists
  as a distinction) is on record; we held the identity position. (They wore
  type-yellow until the 2026-07 cleanup, §9.)
- **Dot-receivers and mid-chain properties are ordinary variables.**
  One Dark Pro paints dot-receivers yellow (`variable.other.object`), so the
  same variable changes color depending on whether it precedes a dot. We
  rejected that under the identity principle (Philosophy §6); `b` in `a.b.c`
  falls under the same decision. What One Dark Pro wanted from that rule,
  container-like things looking yellow, is achieved honestly by the semantic
  namespace and class rules. The resulting TextMate/semantic disagreements
  are permanent `allow.json` entries.
- **The key family is red across formats**: JSON keys, YAML keys, CSS
  property names (the CSS entry closed a hole in the family, with Zed as the
  source), and TOML array keys. A One Dark Pro leftover painted TOML array
  keys type-yellow; it surfaced the moment semantic rules became
  family-named, because "tomlArrayKey: type" reads as wrong in a way
  "#e5c07b" never did. Vendor-prefixed CSS properties (`-webkit-*`) stay
  cyan: vendor prefixes are platform-provided.
- **Parameters are red italic.** The ecosystem survey isolated this as a
  One Dark Pro signature (red is common, the italic is not). We keep it
  deliberately, and record it as taste, not provenance (Philosophy §7). A
  Python-only parameter color was an exception to the family and was removed
  in 2026-07 (§9).

## 5. Embedded boundaries and strings

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
  this theme's goals (Philosophy §3). The five-source score was a thin 3-2
  (the modern generations read regexps as "special strings", orange); the
  ecosystem survey (JetBrains, akamud, Sublime all cyan) widened the margin
  and closed the question.
- **Markdown link URLs are cyan** (origin restoration, same reconciliation
  as `${}`).
- **HTML entities are orange** (Atom and Zed agree across two generations
  against an unexplained 2017 One Dark Pro edit).
- **CSS units are orange.** One Dark Pro's red traced to an external 2018
  bulk PR baked in by a generator rewrite; it was not even the author's
  design.

## 6. Markup

- **Tags red, attributes orange**: near-unanimous across sources and the
  ecosystem (base16 lists "XML Tags" under base08 red). Zed's blue markup
  family is Zed's own design direction and survives only in the retired Zed
  variants (Appendix).
- **Headings red** (the One Dark tradition, not the cyan of some
  derivatives).

## 7. Shell

- **Command names green, flags (`constant.other.option`) cyan, unquoted
  arguments plain**: the terminal look, matching zsh-syntax-highlighting.
  The green is one of the two accepted exceptions to the family rule
  (Philosophy §2); it was reviewed in the 2026-07 cleanup and kept.

## 8. Workbench (UI layer)

- **Icon colors stay on VS Code defaults** (2026-08-12). This is a syntax
  theme. We touch the UI layer only when something is genuinely hard to see
  or easy to confuse, never just for consistency with the token vocabulary
  (Philosophy §3). VS Code's icon palette is legible on the dark workbench,
  so `symbolIcon.*` and the other icon keys are not themed, even though the
  icons render the same classification as tokens.
- **The same bar keeps `scmGraph`'s color-blind-safe palette, charts, and
  merge/diff state colors on defaults.**
- **The 2026 accent remap clears the bar**: upstream's teal collides with
  syntax cyan `#56B6C2`, so the 13-color accent family is recolored to
  `#528BFF` (guarded by the hue-band scan, Philosophy §9).

## 9. Mistakes we corrected

Conclusions this project got wrong and later fixed in public. They stay here
because re-checking our own decisions is part of the method.

The consistency cleanup (2026-07). Auditing the theme against its own
principles found five places where it broke its own rules:

1. Go primitive types purple while TypeScript's were yellow — fixed (§3).
2. `this`/`self` wearing type-yellow — fixed (§4).
3. A per-language exception color for Python parameters — fixed (§4).
4. A per-language exception color for JSON booleans — fixed (§2).
5. Shell command names green — reviewed and kept (§7).

A late echo: four Dart-only semantic exceptions (One Dark Pro leftovers) were
removed once family naming made them visible, the same decision as the
Python-parameter one. The lesson: layer consistency (what the flicker audit
checks) is not family consistency. The former can be satisfied while the
latter is still broken.

Individual corrections:

- "Zed doesn't support LSP semantic highlighting" — outdated; it landed in
  2026-02 as an opt-in. The Zed variants modeled the `"combined"` mode
  (Appendix).
- "Type-cyan is a base16 template artifact" — half wrong; see §3.
- "One Dark Pro's regexp red was an accident" — it was a deliberate Dark+
  imitation, which changes the reason it was rejected, not the outcome (§5).
- "Zed's regexp orange is found nowhere else" — it sides with the modern
  tree-sitter ontology; the cyan decision stands on other grounds (§5).
- A `function.defaultLibrary` cyan "fix" shipped briefly and was reverted:
  the flicker harness showed it introduced flicker rather than removing it
  (Philosophy §5, §9).
- An all-plain operator scheme shipped briefly and was reverted when daily
  use showed it was wrong (§1).

## Appendix. The Zed episode: fidelity as an instrument

For a stretch of v0.0.x this repository also shipped two themes reproducing
Zed's One Dark interpretation verbatim, including the parts the decisions
above reject (blue markup, cyan types, yellow `nil`). Their contract was
fidelity, not judgment: a mechanical translation of Zed's theme slots and
semantic rule files, verified token by token against real tree-sitter parses
with Zed's own vendored queries (5,000+ captures, zero mismatches), with a
"gap-fills yes, bugs no" rule for what Zed left unspecified. They modeled
Zed's `"combined"` mode once it became clear that Zed does support opt-in
LSP semantic highlighting (§9).

The variants were retired at v0.1.0, but the episode shaped the principles.
Living inside Zed's interpretation surfaced most of the operator, markup and
type-family questions decided above, and the faithful reproduction worked as
a measuring instrument: several "is our color or Zed's correct?" disputes
were settled by having both renderings side by side. Anyone who wants Zed's
interpretation should use Zed's theme in Zed. Reproducing another editor's
judgment is a research tool, not a product.
