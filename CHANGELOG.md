# Change Log

## [0.1.6] - 2026-09-05

### Changed

- The `.vsix` now contains only what VS Code needs at runtime (the two
  theme files, `package.json` and the README): 6 files instead of 58.
- Design documentation is split into `docs/PHILOSOPHY.md` (principles) and
  `docs/DECISIONS.md` (the per-family decision record), each with a
  Japanese version. The upstream workbench theme is called by its VS Code
  name, Dark 2026.
- The flicker audit runs against TypeScript 7's built-in language server;
  three TextMate/semantic disagreements that follow from TypeScript 7
  classifying by declared type are recorded in `audit/allow.json`.
- Tooling dependencies pruned: `typescript-language-server` and the unused
  tree-sitter packages are gone, and `@vscode/vsce` lives in its own locked
  install under `tools/vsce/`. Theme colors are unchanged.

## [0.1.3] - 2026-08-12

### Changed

- `textPreformat` — inline code in hovers and rendered Markdown — is One Dark
  green instead of upstream's grey on grey.
- The JetBrains, Ghostty, Windows Terminal and Vim artifacts are generated
  from One Dark 2026 rather than One Dark Modern. Their backgrounds move from
  `#181818` to `#191A1B`; syntax colors are unchanged.
- Tracked 2026 Dark upstream: new `activityBar.activeBackground` and
  `surface.*` keys, and `inputOption.activeBackground` follows upstream from
  an accent tint to a neutral grey.

## [0.1.2] and earlier

See the [GitHub releases](https://github.com/hn-11/one-dark-modern/releases).
