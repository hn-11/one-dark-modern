# Decisions

> 日本語版: [DECISIONS.ja.md](DECISIONS.ja.md)

This is the record of contested color decisions, grouped by token family,
followed by the mistakes we corrected. Each entry states the decision first
and then gives the evidence and the history behind it. Dates are kept where
we know them, because several decisions replace earlier ones.

The principles behind these decisions are in
[PHILOSOPHY.md](PHILOSOPHY.md), and a reference like "Philosophy §4" points
there. When a change settles a new question, add it here.

## 1. Operators

Symbol operators are cyan `#56B6C2` in every language. We decided this on
2026-07-20, because no source splits the operator family. TextMate-era Atom made all
operators purple, late Atom left them all plain, Zed makes them all cyan,
and base16 files operators under base05, the foreground. The ecosystem
survey later showed that cyan is one of three viable camps alongside plain
and purple, shared with akamud and One Dark Pro.nvim. One Dark Pro had
shipped a mix — logical operators cyan, ternary and optional purple through
a word-operator group, the arrow purple, the rest plain — and that mix
failed provenance review and was dropped in one sweep. An all-plain scheme
shipped first. It was correct on paper and was reversed on sight the same
day, because washed-out operators did not survive daily use, and we adopted
Zed's all-cyan position instead.

`=>` is an operator, not a keyword (decided 2026-07-20). The purple arrow of
TextMate-Atom and One Dark Pro lost to the modern sources: the official
tree-sitter queries list `"=>"` in the same `@operator` capture as every
other symbol.

Word operators stay purple: `new`, `typeof`, `instanceof`, `in`, `of`,
`delete`, `void`, and Python's `and/or/not`. Words are keywords and symbols
are operators, and each family is uniform inside.

Type-world marks stay plain: the annotation `:`, the optional `?`, and the
union `|`. Zed paints these dark red as `punctuation.special`, but that is
Zed's own invention and we did not import it.

Go's operators are one cyan family (`:=` `+` `*` `&` `&&` `==`). One Dark
Pro had two Go quirks: `:=` was yellow, from a 2018 commit with no stated
reason, and pointers were purple, from a 2020 bug-report patch. Both were
dropped. When the generic operator decision later threatened to leave Go's
`&&` plain, a `.go`-scoped entry kept the family whole.

There is no semantic `operator` entry. rust-analyzer and other servers were
flattening TextMate's per-language operator colors, so the entry was
removed under the layering principle of Philosophy §5.

## 2. Constants and literals

Named constants are merged into the orange value family, as of
2026-07-20. `const` locals, SCREAMING constants, enum members and platform
constants such as `Math.PI` and `JSON` all wear `#D19A66`, like numbers and
booleans, and since this merge yellow means exactly one thing: the type
family. The old yellow split was a One Dark Pro signature that no other
branch of the family shares; the few ecosystem themes that split at all use
cyan or violet, and base16 files constants and literals together under
base09. The merge initially left `variable.defaultLibrary` yellow. Three
new flicker violations on `JSON` caught it, and the audit forced the fix
before release. In other words, the principle change located the one rule
the sweep had missed.

`nil`, `null` and `None` are orange, because they are literals. Zed's
yellow `nil` is isolated twice over: no other implementation uses yellow,
and Zed's own query splits `nil` from `true` and `false`, a split the
official tree-sitter query explicitly contradicts by grouping `true`,
`false`, `nil` and `iota` in one `@constant.builtin` capture.

JSON booleans are orange, which restores the agreement between
TextMate-Atom and Zed over a One Dark Pro per-language exception. It was
found in the 2026-07 consistency cleanup described in §9.

## 3. Types

The type family is yellow, and yellow is only the type family. That covers
class, interface, enum, namespace, struct and type parameters, including
Go's builtin primitive types `int`, `string` and `error`: a type is yellow
because it is a type, not because of how it is spelled. Go primitives were
purple until the 2026-07 cleanup described in §9.

Zed's type-cyan is legitimate ancestry, but we did not adopt it. Digging
through the history corrected an earlier conclusion here, because cyan
types are not a base16 template artifact. Tree-sitter-era Atom itself
rendered types cyan, through `type_identifier → support.storage.type`, and
Zed's 2023 hand-tune kept that deliberately, so yellow and cyan are both
Atom ancestry from different eras. This theme's stack of TextMate grammars
plus a language server descends from the TextMate generation, and the
ecosystem survey found types-yellow unanimous across all eight
implementations. Yellow stands.

## 4. Variables, keys, and parameters

The variable family is red, and that includes `this` and `self`. They are
values, so they get variable red rather than a color of their own, as
Philosophy §6 explains. There is an objection on record from the modern
tree-sitter ontology, which has `@variable.builtin` as a distinction, but
we held the identity position. They wore type-yellow until the 2026-07
cleanup in §9.

Dot-receivers and mid-chain properties are ordinary variables. One Dark Pro
paints dot-receivers yellow through `variable.other.object`, so the same
variable changes color depending on whether a dot follows it; we rejected
that under the identity principle of Philosophy §6, and `b` in `a.b.c`
falls under the same decision. What One Dark Pro wanted from that rule was
for container-like things to look yellow, and the semantic namespace and
class rules achieve that honestly. The TextMate/semantic disagreements this
causes are permanent `allow.json` entries.

The key family is red across formats: JSON keys, YAML keys, CSS property
names and TOML array keys. The CSS entry closed a hole in the family, with
Zed as the source. TOML array keys had been type-yellow, a One Dark Pro
leftover that surfaced the moment semantic rules became family-named,
because "tomlArrayKey: type" reads as wrong in a way that "#e5c07b" never
did. Vendor-prefixed CSS properties like `-webkit-*` stay cyan, since a
vendor prefix is something the platform provides.

Parameters are red italic. The ecosystem survey isolated this as a One Dark
Pro signature (red is common there, the italic is not), and we keep it on
purpose, recorded as taste rather than provenance per Philosophy §7. A
Python-only parameter color was an exception to the family, and §9 records
its removal in 2026-07.

## 5. Embedded boundaries and strings

`${}` and embedded punctuation are dark red `#BE5046`, restored to the
origin after a mechanical reconciliation of all 78 TextMate-Atom
assignments. The origin, base16's 0F slot for "embedded language tags", and
every Atom-faithful port (akamud, joshdick, Sublime) agree. Tree-sitter-era
Atom lost this color because the migration had no brace mapping — that was
translation loss rather than a decision — and One Dark Pro never carried it
at all. JSX expression braces carry the same scope and the same meaning, a
boundary between languages, and are deliberately exempt from the
workbench's bracket-depth cycling.

`variable.interpolation` is dark red, same family.

Regexps are cyan. One Dark Pro's red was a deliberate 2022 change that
mimicked VS Code Dark+ (issue #678), and mimicking Dark+ is not one of this
theme's goals, as Philosophy §3 says. The five-source score was a thin 3-2,
because the modern generations read regexps as "special strings" and paint
them orange; the ecosystem survey widened the margin and closed the
question, with JetBrains, akamud and Sublime all cyan.

Markdown link URLs are cyan, an origin restoration from the same
reconciliation as `${}`.

HTML entities are orange: Atom and Zed agree across two generations against
an unexplained 2017 One Dark Pro edit.

CSS units are orange. One Dark Pro's red traced back to an external 2018
bulk PR that a generator rewrite baked in, so it was not even the author's
design.

## 6. Markup

Tags are red and attributes are orange. This is near-unanimous across the
sources and the ecosystem (base16 lists "XML Tags" under base08 red). Zed's
blue markup family is Zed's own design direction and survives only in the
retired Zed variants described in the appendix.

Headings are red, the One Dark tradition, unlike the cyan of some
derivatives.

## 7. Shell

Command names are green, flags matching `constant.other.option` are cyan,
and unquoted arguments are plain: the terminal look, matching
zsh-syntax-highlighting. The green is one of the two accepted exceptions to
the family rule in Philosophy §2, and it was reviewed in the 2026-07
cleanup and kept.

## 8. Workbench (UI layer)

Icon colors stay on VS Code defaults. Decided 2026-08-12. This is a syntax
theme, and we touch the UI layer only when something is genuinely hard to
see or easy to confuse, never for consistency with the token vocabulary
alone; Philosophy §3 states the non-goal. VS Code's icon palette is legible
on the dark workbench, so `symbolIcon.*` and the other icon keys are not
themed, even though the icons render the same classification as the tokens
do.

The same bar keeps `scmGraph`'s color-blind-safe palette, the charts, and
the merge and diff state colors on their defaults.

The 2026 accent remap clears the bar. Upstream's teal collides with the
syntax cyan `#56B6C2`, so the 13-color accent family is recolored to
`#528BFF`, guarded by the hue-band scan of Philosophy §9.

## 9. Mistakes we corrected

These are conclusions the project got wrong and later fixed in public. They
stay here because re-checking our own decisions is part of the method.

The consistency cleanup of 2026-07 came from auditing the theme against its
own principles, and it found five places where the theme broke its own
rules:

1. Go primitive types were purple while TypeScript's were yellow. Fixed;
   see §3.
2. `this` and `self` wore type-yellow. Fixed; see §4.
3. Python parameters had a per-language exception color. Fixed; see §4.
4. JSON booleans had a per-language exception color. Fixed; see §2.
5. Shell command names were green. Reviewed and kept; see §7.

One more turned up late: four Dart-only semantic exceptions, all One Dark
Pro leftovers, were removed once family naming made them visible, the same
decision as the Python-parameter one. The lesson is that layer consistency,
which the flicker audit checks, is not family consistency; the first can
hold while the second is still broken.

Individual corrections:

- "Zed doesn't support LSP semantic highlighting." Outdated: it landed in
  2026-02 as an opt-in, and the Zed variants modeled the `"combined"` mode
  (see the appendix).
- "Type-cyan is a base16 template artifact." Half wrong, as §3 explains.
- "One Dark Pro's regexp red was an accident." It was a deliberate Dark+
  imitation, which changes the reason it was rejected but not the outcome.
  See §5.
- "Zed's regexp orange is found nowhere else." It sides with the modern
  tree-sitter ontology, and the cyan decision in §5 stands on other
  grounds.
- A `function.defaultLibrary` cyan "fix" shipped briefly and was reverted
  when the flicker harness showed that it introduced flicker instead of
  removing it (Philosophy §5 and §9).
- An all-plain operator scheme shipped briefly and was reverted once daily
  use showed it was wrong. §1 has the story.

## Appendix. The Zed episode: fidelity as an instrument

For a stretch of v0.0.x this repository also shipped two themes that
reproduced Zed's One Dark interpretation verbatim, including the parts the
decisions above reject: blue markup, cyan types, yellow `nil`. Their
contract was fidelity rather than judgment. They were a mechanical
translation of Zed's theme slots and semantic rule files, verified token by
token against real tree-sitter parses with Zed's own vendored queries (more
than 5,000 captures, zero mismatches), with a "gap-fills yes, bugs no" rule
for whatever Zed left unspecified. Once it became clear that Zed does
support opt-in LSP semantic highlighting, they modeled Zed's `"combined"`
mode, which is one of the corrections in §9.

The variants were retired at v0.1.0, but the episode shaped the principles.
Living inside Zed's interpretation surfaced most of the operator, markup and
type-family questions decided above, and the faithful reproduction worked
as a measuring instrument: several "is our color or Zed's correct?"
disputes were settled by putting both renderings side by side. Anyone who
wants Zed's interpretation should use Zed's theme in Zed. Reproducing
another editor's judgment is a research tool, not a product.
