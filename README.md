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

### JetBrains IDEs (IDEA / GoLand / WebStorm / PyCharm)

Download `one-dark-modern-jetbrains-<version>.jar` from Releases, then
**Settings → Plugins → ⚙ → Install Plugin from Disk…** and restart. The plugin
is generated from the same VS Code theme file, so the palette is identical by
construction (`scripts/build-jetbrains.ts` maps it to IntelliJ attribute keys,
with dedicated mappings for Java, Go, JS/TS, and Python).

## How it works

The theme is **generated** from upstream snapshots plus this repo's overrides:

```
upstream/dark_modern.json   (auto-synced)  ─┐
upstream/OneDark-Pro.json   (auto-synced)  ─┤→ scripts/build.ts → themes/one-dark-modern-color-theme.json
overrides/{colors,tokens,semantic}.json    ─┘
```

`overrides/` is the only thing meant to be edited by hand — it holds everything
this theme intentionally does differently from its upstreams (~56 colors,
9 token rules, 23 semantic entries). An override with the same key/scope as an
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
`audit/allow.json` with reasons. Python/Shell are TM-only (Pylance is
closed-source; shell has no semantic server).

## Upstream sync (automated)

A [monthly workflow](.github/workflows/check-upstream.yml) re-fetches both
upstream files, rebuilds the theme, and opens an auto-merge PR. CI guards the
result (typecheck, reproducible build, packaging). Upstream changes flow in
automatically unless they collide with an override — in that case the override
wins by construction, so nothing we've customized can be silently reverted.

## Releasing

```sh
npm version patch            # bumps package.json + creates the git tag
npm run build && git add themes && git commit --amend --no-edit
git push origin main --tags
```

The [release workflow](.github/workflows/release.yml) checks the tag against
`package.json`, builds the `.vsix`, and attaches it to a GitHub Release.
