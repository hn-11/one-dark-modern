# Design Philosophy

Every color decision in this theme follows from the principles below. Where
principles collided in practice, the actual ruling is recorded as **case law**.
When in doubt, come back here.

## 0. The color vocabulary

Each color maps to a **family of meaning**. Being able to read the kind of a
symbol from its color is the theme's core value; changes that dilute a
mapping (borrowing a color for another family) are forbidden by default.

| Color | Value | Meaning |
|---|---|---|
| Purple | `#C678DD` | Keywords, control flow, storage (`func` `if` `const` `import`) |
| Blue | `#61AFEF` | Callables (functions, methods, decorators, macros) |
| Yellow | `#E5C07B` | The type family (class/interface/enum/namespace) + const values + enum members |
| Red | `#E06C75` | The variable family (variables, fields, parameters, `this`/`self`) + tags + headings |
| Cyan | `#56B6C2` | Platform-provided magic: builtins (`support.*`), escapes, regexps, shell flags |
| Green | `#98C379` | Strings, inserted diffs, shell command names |
| Orange | `#D19A66` | Literals (numbers, booleans), attribute names, bold markup |
| Gray | `#7F848E` | Comments (italic) |
| Foreground | `#ABB2BF` | Operators, punctuation — and the deliberate choice *not* to highlight |

One canonized exception survives by design: shell command names are green
(string color) to mirror zsh-syntax-highlighting in terminals - family-impure,
kept deliberately.

The UI is Dark Modern (`#181818` / `#1F1F1F`, accent `#0078D4`); the terminal
palette is Atom one-dark-ui's ANSI 16. This three-way blend *is* the theme's
concept.

## 1. Lexical belongs to TextMate; semantic corrects

- **What cannot be misclassified** (keywords, strings, numbers, comments,
  operators, punctuation) belongs to TextMate. Regexes are sufficient there,
  and TM keeps working before the LSP starts and inside Markdown fences.
- **What can be misclassified** (the role of an identifier: variable? type?
  function?) is corrected by semantic tokens.
- Therefore: **a semantic rule that repaints a color TextMate set deliberately
  is a violation.** Semantic may only fill in tokens TM left at the plain
  foreground, or fix places where TM's own guess is wrong.
- `npm run audit` (real grammars + real LSPs) enforces this mechanically.
  Exceptions exist only in `audit/allow.json`, each with a reason.

Case law: the semantic `operator` entry was removed (rust-analyzer et al. were
flattening TM's per-language operator colors to gray). A `function.defaultLibrary`
cyan "fix" turned out to *introduce* flicker and was reverted after the
harness falsified it.

## 2. Same symbol, same color

Color attaches to what a symbol **is**, not to **where it is written**.

Case law: One Dark Pro has a hidden rule painting dot-receivers yellow
(`variable.other.object`). The same variable changing color line-by-line
violates this principle, so it was **rejected** (approved by hn). Mid-chain
properties (`b` in `a.b.c`) fall under the same ruling. What ODP actually
wanted from that rule — "container-like things look yellow" — is achieved
honestly by semantic namespace/class/defaultLibrary.

## 3. ODP pragmatism (no purism)

A faithful rebuild from atom/one-dark-syntax was tried once and **rejected**
(gray parameters, white operators and dark comments did not survive daily
use). One Dark Pro's ~150 language-specific rules are not cruft — they are a
decade of tuning against each grammar's quirks.

- The yardstick is not "what upstream did" but "what looks right to eyes
  calibrated on ODP".
- When this collides with principle 2 (identity), principle 2 wins
  (see the receiver-yellow ruling).
- The origin can win back individual tokens on taste (2026-07, hn's call).
  Criterion used: when Atom AND Zed - two generations of the family - agree
  and only ODP deviates, the deviation is suspect. A mechanical
  reconciliation of all 78 base.less assignments found exactly four such
  tokens; three were restored:
  - template-expression / embedded punctuation -> `#BE5046` (hue-5-2)
  - `variable.interpolation` -> `#BE5046`
  - markdown link URLs -> `#56B6C2` (cyan)
  The fourth (comment brightness) stays ODP per the readability ruling.
  Separately, `string.regexp` was restored to cyan: ODP's red turned out to
  be a duplicate-rule accident canonized, and it contradicted our own
  semantic `regexp` and the color vocabulary (section 0).

Case law (2026-07, the self-consistency purge): auditing the theme against
this very document found five self-violations, four fixed: Go primitive
types were purple while TS's were yellow (a flicker-fix had canonized the
split - both now yellow); `this`/`self` wore type-yellow while being values
(now variable-red, which is also Atom's original); Python parameters and
JSON booleans had per-language exception colors (now uniform red / orange -
the JSON fix also restores Atom+Zed two-generation agreement); enum members
were cyan while consts were yellow (both compile-time constants - now both
yellow). The shell-green exception was reviewed and kept. Lesson: layer
consistency (what the flicker audit checks) is not family consistency -
the former can be satisfied while canonizing the latter's violation.

Case law (2026-07, the Zed type-cyan investigation, CORRECTED after deep
archaeology): the first ruling ("base16 template artifact") was half wrong.
Full picture: Zed's One Dark began (2022-07) as base16-onedark through a
generic factory (keyword blue, function yellow, type cyan - clearly not
One Dark deliberation at that stage), but the 2023-02 hand-tuning by Nate
Butler, answering issue #5793's demand for Atom fidelity, deliberately kept
type=teal - and that IS faithful to LATE Atom: from 2018 the tree-sitter
grammars mapped type_identifier to support.storage.type, rendering types
CYAN. So both colors carry Atom ancestry from different eras: yellow =
TextMate-era Atom (what ODP and we inherit), cyan = tree-sitter-era Atom
(what Zed inherits). Our yellow stands - it matches our TM+LSP stack's
lineage and hn's Record<> ruling - but the claim "cyan has no One Dark
pedigree" is withdrawn. Lessons kept: check an authority's pedigree before
joining it - and re-check your own verdicts when new strata surface.
Corollary intact: base16's 0F slot (#BE5046, "embedded language tags")
independently confirms the ${} restoration.

## 4. One source of truth, generated everywhere

**The built VS Code theme (`themes/*.json`) is the single source of truth for
every platform.** The JetBrains `.icls`, Ghostty, Windows Terminal and Vim
artifacts are all generated from it, so hex parity holds by construction.

- Never hand-edit generated files (`themes/`, `dist/`); CI verifies
  reproducibility.
- The only hand-edited surfaces are `overrides/` and the judgment records
  under `audit/`.

## 5. Overrides are the complete list of intent

`overrides/` holds only what this theme **deliberately** does differently from
its upstreams (Dark Modern / ODP). The test for keeping an entry: *"if this
were deleted, would the theme's concept be damaged?"* If not, defer to
upstream — the smaller the overrides, the more the monthly auto-sync pays off.

Case law: 15 color entries that accidentally pinned stale Dark Modern values
and 5 leftovers from the atom experiment were deleted (v0.0.13). Current
size: 41 colors, 7 token rules, 27 semantic entries.

## 6. Decisions are data

The *why* behind a color lives in machine-readable places with reasons, not
in chat logs or commit messages:

- `audit/allow.json` — where semantic may override TM, and why
- `audit/jetbrains-expected.json` — colors guaranteed in the real IDEs, and
  documented divergences
- this document — principles and case law

Together they form the case-law record of "which layer's intent wins".
Changes should be checked against precedent first.

## 7. Measure, don't assume

Colors are verified against **real engines**, not knowledge, mapping tables
or corpora:

- VS Code: `vscode-textmate` + gopls / typescript-language-server
  (`npm run audit`)
- JetBrains: headless GoLand / WebStorm dumping actual token attribute keys
  (`jetbrains-audit/`)

Evidence, all from this repo's history: a careful manual audit misjudged the
builtin color; the theme-corpus check missed the real key `GO_LOCAL_VARIABLE`;
a lookup-table checker (rejected) can never find violations it doesn't
already know about. **Every bug class that happened once gets a machine
guard** (the receiver incident produced the attribute-key existence check).

## 8. Accept platform vocabulary limits

Distinctions a platform cannot express are documented as divergences, not
fought:

- IntelliJ has no const/readonly key for TS → consts stay red there
  (VS Code: yellow)
- PyCharm has no parameter-specific key → `DEFAULT_PARAMETER` (red italic)
  stands in (VS Code Python: orange)
- Pylance is closed-source → Python's semantic layer is outside automated
  verification (covered by eyeballs)

Invest in verification proportionally to **how much intelligence sits between
the theme and the pixels**: IntelliJ > VS Code > Vim > terminals (Ghostty/WT
are passive palettes; generation correctness is all there is to check).

## Operations

- Upstreams sync monthly via an auto-merge PR gated by CI
  (build + flicker-audit).
- The human's job is only: (a) screenshot a mismatch, (b) add one entry to
  `overrides/`, (c) record the ruling.
- Releasing is `npm version patch` — five platform artifacts ship
  automatically.
