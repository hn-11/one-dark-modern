# One Dark Modern

A VS Code color theme that pairs One Dark syntax highlighting with the
[Dark Modern](https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/dark_modern.json)
workbench UI.

- **Syntax**: this repository's own One Dark ruleset (`syntax/`) —
  vendored from a decade of [One Dark Pro](https://github.com/Binaryify/OneDark-Pro)
  grammar tuning at v0.1.0 and curated by provenance against the wider One
  Dark family since (see [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md) and
  [docs/DECISIONS.md](docs/DECISIONS.md)).
- **UI**: Dark Modern's `#181818`/`#1f1f1f` workbench with the `#0078d4` accent.
- **Terminal / brackets**: One Dark ANSI palette and bracket-pair colors.

## Installation

Download the `.vsix` from [Releases](https://github.com/hn-11/one-dark-modern/releases) and run:

```sh
code --install-extension one-dark-modern-<version>.vsix
```

Then select **One Dark Modern** via `Cmd+K Cmd+T`.

The extension also ships **One Dark 2026** — the same One Dark syntax on
VS Code's [Dark 2026](https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/2026-dark.json)
workbench (darker `#121314` background), which as of VS Code 1.113 is the
editor's default dark theme, with the accent recolored to One
Dark's `#528BFF` (Atom's accent, same as the cursor) via
`overrides/accent-2026.json` - alpha-preserving, so upstream accent keys are
remapped automatically. It tracks upstream through the same automated sync;
variant-specific tweaks go in `overrides/colors-2026.json`. The
JetBrains/terminal/Vim artifacts are generated from One Dark 2026.

Across both themes the policy is: **backgrounds belong to the UI
generation** (Dark Modern `#1F1F1F` / Dark 2026 `#121314`); the syntax layer
contributes only text colors, terminal palette, selection and accent.

### JetBrains IDEs (IDEA / GoLand / WebStorm / PyCharm)

Download `OneDarkModern.icls` from Releases, then
**Settings → Editor → Color Scheme → ⚙ → Import Scheme…** and select it.
The scheme is generated from the same VS Code theme file, so the palette is
identical by construction (`scripts/build-jetbrains.ts` maps it to IntelliJ
attribute keys, with dedicated mappings for Java, Go, JS/TS, Python and
Shell). It covers the editor, console ANSI colors and VCS gutters; the IDE
chrome keeps whatever UI theme you use (Dark works well).

The design principles live in [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md) and
the individual color decisions, with their evidence and history, in
[docs/DECISIONS.md](docs/DECISIONS.md)
(日本語版: [PHILOSOPHY.ja.md](docs/PHILOSOPHY.ja.md) /
[DECISIONS.ja.md](docs/DECISIONS.ja.md)).

## How it works

The theme is **generated**. Syntax colors come from this repository's own
source; only the workbench UI has upstreams:

```
upstream/dark_modern.json  (auto-synced)   ─┐
upstream/2026-dark.json    (auto-synced)   ─┤→ scripts/build.ts → themes/*.json
syntax/{families,tokens,semantic}.json (ours) ─┤
overrides/colors*.json         (ours)      ─┘
```

- `syntax/` is the theme's own syntax definition: `families.json` maps the
  twelve-family color vocabulary to hex values, and `tokens.json` holds 14
  TextMate rules (~450 scopes) that reference families by name — plus 30
  semantic entries. It has **no upstream** — every rule stands on the decision
  record in `docs/DECISIONS.md`, and the build fails if any rule or
  semantic entry uses a color outside the vocabulary. The rules were
  vendored from the built theme at v0.1.0 (byte-identical output,
  machine-verified) once every contested One Dark Pro rule had been either
  confirmed or dropped; the v0.1.1 refactor then collapsed them from 288 to
  14 by merging same-family rules, with every step verified against the
  real TextMate engine (identical resolution for all 6,762 fixture tokens
  and all 464 selectors).
- `overrides/` holds the UI-layer diffs against Dark Modern / Dark 2026
  (41 colors, plus the 2026 accent map). An override with the same key as
  an upstream entry replaces it; everything else flows through. The test
  for keeping an override: if this were deleted, would the theme's concept
  be damaged? If not, defer to upstream — the smaller the overrides, the
  more the auto-sync pays off.
- `themes/` and `dist/` are generated; never hand-edit them (CI verifies
  reproducibility). The hand-edited surfaces are `syntax/`, `overrides/`
  and the records under `audit/`.
- The built `themes/*.json` is the source of truth for every other
  platform: the JetBrains `.icls`, Ghostty, Windows Terminal and Vim
  artifacts are generated from One Dark 2026 (`loadBuiltTheme` in
  `scripts/lib.ts`), so hex parity holds by construction. They keep the
  "One Dark Modern" scheme name, which is the extension's identity rather
  than a variant label. Releasing by hand is `npm version patch` (see
  Releasing below).

```sh
npm ci
npm run build      # regenerate themes/
npm run typecheck
npm run package    # build the .vsix
```

Requires Node.js >= 23.6 (scripts run as native TypeScript).

### Flicker audit

Colors are verified against real engines, not against mapping tables or
theme corpora. `npm run audit` (also run in CI) tokenizes `audit/fixtures/` with the real
TextMate grammars (through `vscode-textmate`) and queries real language servers (gopls,
typescript-language-server) for semantic tokens, then reports every token
whose color would visibly change when semantic highlighting lands. The rule:
semantic may *correct* tokens TextMate left at the plain foreground, but must
not repaint a color TextMate set deliberately — intentional exceptions live in
`audit/allow.json` with reasons (optionally scoped to an exact TextMate color via
`tmColor`). Python/Shell are TextMate-only (Pylance is closed-source; shell has no
semantic server).

### JetBrains headless audit

`jetbrains-audit/` runs the same idea against the real IDEs: a Gradle test
downloads GoLand / WebStorm, opens the fixtures headlessly, and dumps every
token's `TextAttributesKey` fallback chain (lexer + annotator layers).
`scripts/compare-jetbrains-dump.ts` resolves those chains against our `.icls`
and checks `audit/jetbrains-expected.json`. Runs in CI monthly and on
JetBrains-related changes:

```sh
cd jetbrains-audit
gradle test -PideType=GO -PideVersion=2026.1 -Pgoroot=$(go env GOROOT)   # JDK 21 via mise.toml; GOROOT enables builtin classification
cd .. && node scripts/compare-jetbrains-dump.ts GO
```

Known vocabulary limits found this way: IntelliJ has no const/readonly key
for TS and no parameter key for Python beyond `DEFAULT_PARAMETER`. How much
verification a platform gets follows how much intelligence sits between the
theme and the pixels: IntelliJ most, then VS Code, then Vim; terminals are
passive palettes, so generation correctness is all there is to check.

Coverage is tracked two ways: observed semantic `type.modifier` combos are
snapshotted in `audit/coverage-semantic.json` (new combos fail the audit until
reviewed and accepted with `npm run audit -- --update`), and individual scope
selectors that no fixture exercises are listed in `audit/coverage-tm.json`.
JetBrains expectations in `audit/jetbrains-expected.json` name vocabulary
*families*, not hex values, so they track vocabulary changes automatically.
`npm run oracle` dumps the real engine's resolution of every fixture token
and every selector — snapshot before and after a `syntax/` restructure and
diff to prove the restructure is invisible. Fixtures under
`audit/fixtures/` include files borrowed from microsoft/vscode's
colorize-tests suite (MIT), plus hand-written samples.

### Maintenance loop

1. Screenshot a mismatch.
2. Adjust `syntax/` or `overrides/`; run `npm run build` and `npm run audit`.
3. Record the decision in `docs/DECISIONS.md`, the reason in
   `audit/allow.json` when semantic must override TextMate, or the
   divergence in `audit/jetbrains-expected.json` when an IDE cannot express
   it. Check those three records before changing a color; together they are
   the precedent.

## Upstream sync (automated)

A [scheduled workflow](.github/workflows/upstream-sync.yml) (weekly while
Dark 2026 still churns as the new default; monthly once it settles)
re-fetches the Microsoft workbench themes, rebuilds, and carries the change
all the way to a release: it opens a PR, waits for the required checks
(`build`, `flicker-audit`), squash-merges, and dispatches the release with
the next patch version. Upstream changes flow in automatically unless they
collide with an override — in that case the override wins by construction,
so nothing customized can be silently reverted. Syntax colors have no
upstream and never change via sync.

To stop a sync, close its PR: `upstream/` stays where it is and the next
scheduled run opens a fresh one.

## Releasing

Upstream syncs release themselves. To cut one by hand:

```sh
npm version patch   # builds, stages themes/, commits, tags, and pushes
```

The [release workflow](.github/workflows/release.yml) checks the tag against
`package.json`, builds the `.vsix`, and attaches it to a GitHub Release. It
also accepts a `tag` input via `workflow_dispatch`, which is how the sync
ships (a tag pushed with `GITHUB_TOKEN` would not start the workflow).
