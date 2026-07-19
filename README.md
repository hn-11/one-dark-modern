# One Dark Modern

A VS Code color theme that combines [One Dark Pro](https://github.com/Binaryify/OneDark-Pro) syntax highlighting (originally from [Atom One Dark](https://github.com/atom/one-dark-syntax)) with the [Dark Modern](https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/dark_modern.json) workbench UI.

- **Syntax**: One Dark Pro token & semantic colors, with a few fixes (`invalid.*` rendered as errors, dead duplicate rules dropped).
- **UI**: Dark Modern's `#181818`/`#1f1f1f` workbench with the `#0078d4` accent.
- **Terminal / brackets**: One Dark ANSI palette and bracket-pair colors.

## Installation

Download the `.vsix` from [Releases](https://github.com/hn-11/one-dark-modern/releases) and run:

```sh
code --install-extension one-dark-modern-<version>.vsix
```

Then select **One Dark Modern** via `Cmd+K Cmd+T`.

The extension also ships **One Dark 2026** — the same One Dark syntax on
VS Code's experimental [2026 Dark](https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/2026-dark.json)
workbench (darker `#121314` background), with the accent recolored to One Dark's `#528BFF` (Atom's accent, same as the cursor) via `overrides/accent-2026.json` - alpha-preserving, so upstream accent keys are remapped automatically. It tracks upstream
through the same automated sync; variant-specific tweaks go in
`overrides/colors-2026.json`. The JetBrains/terminal/Vim artifacts remain
based on One Dark Modern.

**Zed One Dark Modern** and **Zed One Dark 2026** translate [Zed's One Dark
interpretation](https://github.com/zed-industries/zed/blob/main/assets/themes/one/one.json)
(desaturated palette, cyan types, `#74ADE8` accent, rendered as Zed's `semantic_tokens: "combined"` mode - the LSP overlay is a mechanical translation of Zed's own semantic token rule files, auto-synced)
onto the same two workbenches - generated fresh from `upstream/zed-one.json`
by `scripts/build-zed.ts`, no ODP inheritance. Fidelity is verified by
`npm run audit:zed` (CI): fixtures are parsed with tree-sitter using Zed's
own vendored highlight queries, each capture resolved against Zed's syntax
slots, and compared token-by-token with our VS Code rendering - 5,200+
captures, zero mismatches, with documented engine-difference exceptions
in `audit/zed-allow.json`.

Since the Zed variants model Zed's *combined* mode, enable semantic tokens
for Go to see the audited rendering (`"gopls": {"ui.semanticTokens": true}`
in settings - the golang extension ships with them off). Plain variables
stay uncolored either way; that is the philosophy, not a gap.

Across all four themes the policy is: **backgrounds belong to the UI
generation** (Dark Modern `#1F1F1F` / 2026 Dark `#121314`); the
interpretation layer (ODP or Zed) contributes only text colors, terminal
palette, selection and accent.

### JetBrains IDEs (IDEA / GoLand / WebStorm / PyCharm)

Download `OneDarkModern.icls` from Releases, then
**Settings → Editor → Color Scheme → ⚙ → Import Scheme…** and select it.
The scheme is generated from the same VS Code theme file, so the palette is
identical by construction (`scripts/build-jetbrains.ts` maps it to IntelliJ
attribute keys, with dedicated mappings for Java, Go, JS/TS, Python and
Shell). It covers the editor, console ANSI colors and VCS gutters; the IDE
chrome keeps whatever UI theme you use (Dark works well).

Design principles and the case law behind color decisions live in
[docs/PHILOSOPHY.md](docs/PHILOSOPHY.md).

## How it works

The theme is **generated** from upstream snapshots plus this repo's overrides:

```
upstream/dark_modern.json   (auto-synced)  ─┐
upstream/OneDark-Pro.json   (auto-synced)  ─┤→ scripts/build.ts → themes/one-dark-modern-color-theme.json
overrides/{colors,tokens,semantic}.json    ─┘
```

`overrides/` is the only thing meant to be edited by hand — it holds everything
this theme intentionally does differently from its upstreams (41 colors,
7 token rules, 27 semantic entries, plus the 2026 accent map). An override with the same key/scope as an
upstream entry replaces it; everything else flows through from upstream.

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
typescript-language-server) for semantic tokens, then reports every token
whose color would visibly change when semantic highlighting lands. The rule:
semantic may *correct* tokens TextMate left at the plain foreground, but must
not repaint a color TextMate set deliberately — intentional exceptions live in
`audit/allow.json` with reasons (optionally scoped to an exact TM color via
`tmColor`). Python/Shell are TM-only (Pylance is closed-source; shell has no
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
for TS (consts stay variable-red, unlike VS Code's yellow) and no parameter
key for Python beyond `DEFAULT_PARAMETER`.

Coverage is tracked two ways: observed semantic `type.modifier` combos are
snapshotted in `audit/coverage-semantic.json` (new combos fail the audit until
reviewed and accepted with `npm run audit -- --update`), and theme rules that
no fixture exercises are listed in `audit/coverage-tm.json`. Fixtures under
`audit/fixtures/` include files borrowed from microsoft/vscode's
colorize-tests suite (MIT), plus hand-written samples.

## Upstream sync (automated)

A [scheduled workflow](.github/workflows/check-upstream.yml) (weekly while
2026 Dark churns; monthly otherwise) re-fetches the upstream files, rebuilds the theme, and opens an auto-merge PR. CI guards the
result (typecheck, reproducible build, packaging). Upstream changes flow in
automatically unless they collide with an override — in that case the override
wins by construction, so nothing we've customized can be silently reverted.
Exception: PRs containing One Dark Pro token changes are not auto-merged —
ODP is a reviewed dependency, not canon (see the provenance rule in
docs/PHILOSOPHY.md).

## Releasing

```sh
npm version patch   # builds, stages themes/, commits, tags, and pushes
```

The [release workflow](.github/workflows/release.yml) checks the tag against
`package.json`, builds the `.vsix`, and attaches it to a GitHub Release.
