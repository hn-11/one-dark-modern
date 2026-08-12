# One Dark Modern

A VS Code color theme that pairs One Dark syntax highlighting with the
[Dark Modern](https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/dark_modern.json)
workbench UI.

- **Syntax**: this repository's own One Dark ruleset (`syntax/`) —
  vendored from a decade of [One Dark Pro](https://github.com/Binaryify/OneDark-Pro)
  grammar tuning at v0.1.0 and curated by provenance against the wider One
  Dark family since (see [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md)).
- **UI**: Dark Modern's `#181818`/`#1f1f1f` workbench with the `#0078d4` accent.
- **Terminal / brackets**: One Dark ANSI palette and bracket-pair colors.

## Installation

Download the `.vsix` from [Releases](https://github.com/hn-11/one-dark-modern/releases) and run:

```sh
code --install-extension one-dark-modern-<version>.vsix
```

Then select **One Dark Modern** via `Cmd+K Cmd+T`.

The extension also ships **One Dark 2026** — the same One Dark syntax on
VS Code's [2026 Dark](https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/2026-dark.json)
workbench (darker `#121314` background), which as of VS Code 1.113 is the
editor's default dark theme, with the accent recolored to One
Dark's `#528BFF` (Atom's accent, same as the cursor) via
`overrides/accent-2026.json` - alpha-preserving, so upstream accent keys are
remapped automatically. It tracks upstream through the same automated sync;
variant-specific tweaks go in `overrides/colors-2026.json`. The
JetBrains/terminal/Vim artifacts are generated from One Dark 2026.

Across both themes the policy is: **backgrounds belong to the UI
generation** (Dark Modern `#1F1F1F` / 2026 Dark `#121314`); the syntax layer
contributes only text colors, terminal palette, selection and accent.

### JetBrains IDEs (IDEA / GoLand / WebStorm / PyCharm)

Download `OneDarkModern.icls` from Releases, then
**Settings → Editor → Color Scheme → ⚙ → Import Scheme…** and select it.
The scheme is generated from the same VS Code theme file, so the palette is
identical by construction (`scripts/build-jetbrains.ts` maps it to IntelliJ
attribute keys, with dedicated mappings for Java, Go, JS/TS, Python and
Shell). It covers the editor, console ANSI colors and VCS gutters; the IDE
chrome keeps whatever UI theme you use (Dark works well).

### Ghostty / Windows Terminal / Vim

These are generated from the same theme file as terminal/editor artifacts;
download them from [Releases](https://github.com/hn-11/one-dark-modern/releases)
like the `.icls`:

- **Ghostty**: `one-dark-modern` — copy it to `~/.config/ghostty/themes/`
  and set `theme = one-dark-modern` in your Ghostty config.
- **Windows Terminal**: `one-dark-modern.json` — paste its contents into
  the `"schemes"` array of Windows Terminal's `settings.json` (or add it
  as a fragment), then set `"colorScheme": "One Dark Modern"` on your
  profile.
- **Vim / Neovim**: `one-dark-modern.vim` — copy it to `~/.vim/colors/` or
  `~/.config/nvim/colors/`, then run `:colorscheme one-dark-modern`
  (requires `termguicolors`).

Design principles and the rulings behind color decisions live in
[docs/PHILOSOPHY.md](docs/PHILOSOPHY.md).

## Language support

Any language gets One Dark's generic scope colors; these tiers describe
where the theme goes beyond that.

- **Audited** — language-specific rules exercised in CI against the real
  TextMate grammars, and (where a server exists) real language servers for
  semantic tokens: Go (gopls), TypeScript/JavaScript/JSX/TSX
  (typescript-language-server), Rust (rust-analyzer), C/C++ (clangd) and
  TOML (taplo — the server behind Even Better TOML, and the only one that
  emits the `tomlArrayKey`/`tomlTableKey` token types the theme has a rule
  for), plus TextMate-only audits for Python, Shell, JSON/JSONC, YAML,
  Markdown, CSS and HTML. HTML is TextMate-only for a concrete reason
  rather than for lack of trying: VS Code's own
  `vscode-html-language-server` advertises no `semanticTokensProvider`
  capability at all, so there is no semantic layer to audit — its embedded
  `<style>`/`<script>` blocks are still tokenized with the real CSS and
  JavaScript grammars. Java and Python are additionally verified inside the
  real JetBrains IDEs by the headless audit.
- **Dedicated rules, not yet audited** — the ruleset carries
  language-specific selectors (inherited from One Dark Pro and curated by
  provenance) for PHP, Ruby, Java, C#, Swift, Elixir, Clojure, Haskell,
  Groovy, Elm, CoffeeScript, INI, Makefile, diff, LaTeX, AsciiDoc, HLSL
  and Unison, among others. They follow the same vocabulary
  but no fixture exercises them yet (`audit/coverage-tm.json` tracks the
  gap).
- **Deliberately dropped** — SCSS/LESS/Sass-specific rules were removed by
  ruling (2026-08-12); those files fall back to generic scopes. Zed-editor
  variants were retired in 0.1.0.

Beyond VS Code, the same source generates artifacts for JetBrains IDEs,
Ghostty, Windows Terminal and Vim/Neovim (see Installation).

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
  ten-color vocabulary to hex values, and `tokens.json` holds 14 TextMate
  rules (~420 scopes) that reference families by name — plus 34 semantic
  entries. It has **no upstream** — every rule stands on the provenance
  record in `docs/PHILOSOPHY.md`, and the build fails if any rule or
  semantic entry uses a color outside the vocabulary.
- `overrides/` holds the UI-layer diffs against Dark Modern / 2026 Dark
  (43 colors, plus the 2026 accent map). An override with the same key as
  an upstream entry replaces it; everything else flows through.

```sh
npm ci
npm run build      # regenerate themes/
npm run typecheck
npm run package    # build the .vsix
```

Requires Node.js >= 23.6 (scripts run as native TypeScript).

### Flicker audit

`npm run audit` (also run in CI) tokenizes `audit/fixtures/` with the real
TextMate grammars and queries real language servers (gopls,
typescript-language-server, rust-analyzer, clangd, taplo) for semantic
tokens, then reports every token whose color would visibly change when
semantic highlighting lands. The rule: semantic may *correct* tokens
TextMate left at the plain foreground, but must not repaint a color
TextMate set deliberately — intentional exceptions live in
`audit/allow.json` with reasons (optionally scoped to an exact TM color via
`tmColor`). Python, Shell, JSON, YAML, Markdown, CSS and HTML are TM-only
(Pylance is closed-source; the rest have no semantic-token server — see
Language support). Unmapped semantic tokens are resolved through VS Code's
default scope-map fallback, fontStyle changes count as flickers, and both
themes' syntax layers are asserted identical before the run.

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
for TS and no parameter key for Python beyond `DEFAULT_PARAMETER`.

Coverage is tracked two ways: observed semantic `type.modifier` combos are
snapshotted in `audit/coverage-semantic.json` (new combos fail the audit until
reviewed and accepted with `npm run audit -- --update`), and individual scope
selectors that no fixture exercises are listed in `audit/coverage-tm.json`.
JetBrains expectations in `audit/jetbrains-expected.json` name vocabulary
*families*, not hex values, so they track doctrine changes automatically.
`npm run oracle` dumps the real engine's resolution of every fixture token
and every selector — snapshot before and after a `syntax/` restructure and
diff to prove the restructure is invisible. Fixtures under
`audit/fixtures/` include files borrowed from microsoft/vscode's
colorize-tests suite (MIT), plus hand-written samples.

## Upstream sync (automated)

A [scheduled workflow](.github/workflows/check-upstream.yml) (weekly while
2026 Dark still churns as the new default; monthly once it settles)
re-fetches the Microsoft workbench
themes, rebuilds, and opens an auto-merge PR. CI guards the result
(typecheck, reproducible build, packaging). Upstream changes flow in
automatically unless they collide with an override — in that case the
override wins by construction, so nothing customized can be silently
reverted. Syntax colors have no upstream and never change via sync.

## Releasing

```sh
npm version patch   # builds, stages themes/, commits, tags, and pushes
```

The [release workflow](.github/workflows/release.yml) checks the tag against
`package.json`, builds the `.vsix`, and attaches it to a GitHub Release.
