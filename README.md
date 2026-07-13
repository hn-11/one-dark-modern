# One Dark Modern

A VS Code color theme that combines [One Dark Pro](https://github.com/Binaryify/OneDark-Pro) syntax highlighting (originally from [Atom One Dark](https://github.com/atom/one-dark-syntax)) with the [Dark Modern](https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/dark_modern.json) workbench UI.

- **Syntax**: One Dark Pro token colors, cleaned up (dead/duplicate rules removed, `invalid.*` rendered as errors) plus `semanticTokenColors` aligned with the TextMate rules — colors stay consistent whether or not a language server is running.
- **UI**: Dark Modern's `#181818`/`#1f1f1f` workbench with the `#0078d4` accent.
- **Terminal / brackets**: One Dark ANSI palette and bracket-pair colors.

## Installation

Download the `.vsix` from [Releases](https://github.com/hn-11/one-dark-modern/releases) and run:

```sh
code --install-extension one-dark-modern-<version>.vsix
```

Then select **One Dark Modern** via `Cmd+K Cmd+T`.

## Development

The theme file is generated — do not edit `themes/one-dark-modern-color-theme.json` directly. Edit the files in `parts/` instead:

| File | Contents |
|---|---|
| `parts/base.json` | name, type, `semanticHighlighting` |
| `parts/colors-editor.json` | editor & peek view colors |
| `parts/colors-ui.json` | workbench UI colors |
| `parts/colors-terminal.json` | terminal / ANSI colors |
| `parts/tokens.json` | TextMate token colors |
| `parts/semantic.json` | semantic token colors |

Then rebuild (the builder is from [jugyo/vscode-theme-skill](https://github.com/jugyo/vscode-theme-skill) and expects to run from the parent directory):

```sh
npm run merge     # regenerate themes/one-dark-modern-color-theme.json
npm run package   # build the .vsix
```

## Releasing

1. Bump the version: `npm run bump` (patch) — or edit `package.json`.
2. Commit, tag, and push:

   ```sh
   git tag v$(node -p "require('./package.json').version")
   git push origin main --tags
   ```

3. The [release workflow](.github/workflows/release.yml) builds the `.vsix` and attaches it to a GitHub Release.

## Tracking upstream

`upstream/` holds snapshots of the two sources this theme derives from:

- `upstream/dark_modern.json` — from `microsoft/vscode` (UI colors)
- `upstream/OneDark-Pro.json` — from `Binaryify/OneDark-Pro` (token colors)

A [weekly workflow](.github/workflows/check-upstream.yml) re-fetches both and opens a PR when they change. The PR diff shows exactly what upstream changed; apply the relevant parts to `parts/` by hand (our files are modified derivatives, so blind syncing is not safe) and merge the snapshot update together with those edits.
