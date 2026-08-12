# Change Log

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

## [0.1.2]

### Changed

- Generated the JetBrains, Ghostty, Windows Terminal and Vim artifacts from
  One Dark 2026 instead of One Dark Modern.
- Refreshed the CI toolchain and dropped the "experimental" framing around
  2026 Dark support.
- Routine upstream syncs (Dark Modern / 2026 Dark) and devDependency
  updates.

## [0.1.1]

### Changed

- **Breaking (internal only, output unchanged)**: rewrote `syntax/` around
  an explicit ten-family vocabulary — `families.json` maps family names to
  hex, and TextMate/semantic rules reference families by name instead of
  hardcoding colors. Collapsed 288 vendored TextMate rules down to 14 by
  merging same-family, same-style rules and deleting dead/duplicate
  selectors; added a build-time lint that rejects any rule or semantic
  entry using a color outside the vocabulary.
- Verified against the real vscode-textmate engine: all 6,762 fixture
  tokens and 464 selector resolutions stayed identical to pre-refactor
  output.

## [0.1.0]

### Changed

- **Breaking**: the syntax layer is now owned by this repository instead
  of tracking One Dark Pro upstream. `syntax/tokens.json` and
  `syntax/semantic.json` were vendored from the (byte-identical,
  machine-verified) built theme after One Dark Pro's rules were each
  ratified or shed by provenance review; `overrides/` now carries only
  UI-layer diffs against Dark Modern / 2026 Dark.
- **Removed**: the Zed One Dark variants (`build-zed`, `audit:zed`, Zed
  upstreams/queries/allow-list) are retired — they served as a measuring
  instrument during provenance review, not a shipped product.

## [0.0.43] and earlier

See the [GitHub releases](https://github.com/hn-11/one-dark-modern/releases).
