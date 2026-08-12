# Repository Improvement Ideas (2026-08-12 audit)

A consolidated review across five areas: build scripts, CI/release,
theme data consistency, docs/metadata, and the audit infrastructure.
Effort: S = small, M = medium, L = large.

## Critical / highest value

1. **No LICENSE file, no `license` field** — the repo vendors One Dark Pro
   (MIT) and microsoft/vscode fixtures (MIT) yet declares no license of its
   own. Add `LICENSE` (MIT) + `"license": "MIT"` in package.json, and a
   `THIRD_PARTY_NOTICES.md` under `audit/fixtures/` naming the borrowed
   files. (S)
2. **Flicker audit ignores VS Code's semantic→TextMate scope fallback**
   (`scripts/audit-flicker.ts` — `if (!semFg) continue`). When a semantic
   token has no `semanticTokenColors` match, VS Code re-resolves it through
   the default token-classification scope map against `tokenColors`, so
   colors *can* change — the audit's core promise has a hole. Implement the
   standard scope map and compare through it. (M)
3. **JetBrains dump filename collision** —
   `HighlightDumpTest.java` keys dumps by basename, so
   `go/colorize/test.go` and `go/colorize13777/test.go` both write
   `test_go.json` (last one wins); `compare-jetbrains-dump.ts` also matches
   by basename. Key by fixture-relative path. (S)
4. **Possible bad hex in `.icls`** — `build-jetbrains.ts` passes several
   `ui()` values (e.g. `errorForeground`, `ANNOTATIONS_COLOR`,
   `LINE_NUMBERS_COLOR`) straight to `attr()`/`raw()` without `blend()`;
   `raw()` (lib.ts) does not strip alpha, so an 8-digit upstream value
   would emit invalid hex. Audit all call sites and normalize. (M)
5. **No screenshots anywhere** — a color theme repo/Marketplace listing with
   zero images. Add screenshots (both themes, VS Code + JetBrains) to
   README. (M)

## Theme data

6. Indent guides diverge between the two themes: `overrides/colors.json`
   only overrides the `…1` bracket-pair keys; Dark Modern falls back to VS
   Code defaults while 2026 Dark ships its own values. Add explicit
   `editorIndentGuide.background`/`activeBackground` overrides. (S)
7. Duplicate scopes in `syntax/tokens.json`: `support.type.object.hlsl`,
   `support.module.node`,
   `punctuation.definition.section.switch-block.end.bracket.curly.php`
   each appear twice within one rule. Remove; add a build-time duplicate
   check (fail on cross-family duplicates). (S)
8. `property.readonly` is not mapped to `value-constant` in
   `syntax/semantic.json`, though `variable.readonly` is and the doctrine
   (PHILOSOPHY §6) covers named constants; readonly class fields stay
   variable-red. Add the mapping (consider `event.readonly` too). (S–M)
9. `editor.selectionHighlightBorder: #dddddd` is an orphan color tied to no
   family; pick a family-derived value or drop the override. (S)
10. Document that the empty `overrides/colors-2026.json` (agents/gauge/chat
    keys left at upstream defaults) is intentional, in PHILOSOPHY. (S)

## Audit infrastructure

11. **Language coverage**: fixtures cover only Go/TS/JS/Py/Sh; 362 of 454
    TM selectors are never exercised. Add grammars+fixtures for
    JSON/YAML/TOML/Markdown first (cheap, big selector recovery), then
    CSS/SCSS/HTML, then Rust/C/C++/PHP/Java. (M–L)
12. Semantic coverage is gopls + tsserver only; `macro`,
    `memberOperatorOverload`, `typeParameter`, `variable.constant` etc. are
    never observed. Add rust-analyzer and clangd sessions (basedpyright for
    Python). (M)
13. Stale-allow detection: `audit/allow.json` entries that never match are
    silently kept and can mask future flickers. Count hits, report/fail on
    unused entries. (S — best effort/value ratio)
14. Over-broad allows: `go/namespace`, `ts/class`, `ts/enumMember` have no
    `tmColor`, so any TM color is excused. Pin `tmColor` (allow arrays). (S)
15. LSP zero-token runs pass silently (`lsp.ts` returns `[]` after retries;
    stderr ignored). Make 0 tokens per fixture fatal, surface stderr, add
    an initialize timeout, handle `msg.error` responses. (S–M)
16. FontStyle flicker unchecked: `compare()` only compares foreground;
    italic `parameter`/`comment` transitions are visible flickers. Compare
    fontStyle bits too. (S–M)
17. Semantic-priority reimplementation diverges from VS Code (ties resolve
    first-wins, no `*.modifier` wildcard support). Fix + table-driven unit
    tests. (S–M)
18. Multi-TM-token spans: matching only the semantic token's start position
    misses color changes mid-span. Check all overlapped TM tokens. (S)
19. Coverage snapshots only guard growth: lost semantic combos and newly
    unexercised selectors pass silently; `coverage-tm.json` isn't
    diff-checked in CI. Report bidirectional diffs and fail on loss. (S)
20. Audit targets one theme (`one-dark-2026`) and oracle the other; either
    loop both or assert the syntax layers are identical. (S)
21. Oracle as CI snapshot: commit `npm run oracle` output and diff it in CI
    (`--check` mode) to catch unintended color changes on every PR. (S)
22. Go fixture `colorize/test.go` doesn't compile (undefined
    `management.*`, `vmutils.*`), degrading gopls output; stub the symbols
    and run `go vet` on fixtures in CI. (S)
23. `audit/fixtures/ts/real-build-jetbrains.ts` is a hand-copied, rotting
    snapshot of the real script; generate it at build time or point the
    audit at `scripts/` directly. (S)
24. JetBrains comparison matches by token *text* with "any color in the
    set passes" and doesn't implement layer priority (daemon over lexer) —
    classic false-negative. Compare the single final visible color, keyed
    by position. (M)
25. JetBrains audit: add IDEA/PyCharm to the matrix (Java/Python mappings
    exist but are unverified); snapshot unresolved keys and fail on new
    ones; add `syntax/**` to workflow path filters; unify the IDE version
    (build.gradle.kts default 2025.1 vs workflow 2026.1); use Gson instead
    of hand-rolled JSON escaping. (S–M each)
26. **WCAG contrast audit** (new `scripts/audit-contrast.ts`):
    `comment-dim #5C6370` is 2.73:1 on `#1F1F1F` (below even the 3.0
    large-text bar), `embedded-boundary` 3.47, `comment` 4.39 — none
    recorded anywhere. Compute family × background ratios, keep a
    reasoned `contrast-allow.json`, fail on regressions. (S–M)
27. No audits at all for the Vim/Ghostty/Windows Terminal artifacts; add
    minimal checks (all ANSI 16 defined, Vim file sources cleanly). (S–M)
28. Light-theme variant: extend `families.json` to `{dark, light}` with
    `light_modern.json` upstream; the contrast audit (26) makes the light
    palette self-verifying. (L)

## Build scripts

29. Deduplicate: the 16-name ANSI list (3 files), `ui`/`fam` helper
    boilerplate (4 files), the GRAMMARS table (oracle vs audit-flicker),
    and the metadata bitmask magic numbers — move to `lib.ts` with a
    source comment. (S)
30. `recolor()` in build.ts uses `startsWith` on hex prefixes — a short
    prefix in `accent-2026.json` would silently mismatch; require full
    6-digit (+optional alpha) matches. (S)
31. `blend()` doesn't validate its base; bad input yields `"nan"` in
    output. Add a guard. (S)
32. Hardcoded UI fallbacks (`ui("editor.background", "#1f1f1f")` etc.) can
    silently drift from upstream; log/warn when a fallback is actually
    used. (M)
33. Runtime-validate `overrides/*.json` and `syntax/*.json` shapes instead
    of trusting type casts. (M)
34. Friendlier errors: existence checks for `dist/jetbrains/*.icls` in the
    JetBrains audit scripts; `mkdirSync` before writing `themes/`. (S)
35. Unit tests for `lib.ts` — especially `jsonc()` (regex-based comment
    stripping breaks on `//` inside string literals) and `blend()`. (M)
36. CRLF tolerance: `split("\n")` in audit/oracle leaves `\r` on lines;
    use `/\r?\n/` or enforce LF in CI. (S)

## CI / release / packaging

37. Pin third-party actions (`peter-evans/create-pull-request`,
    `softprops/action-gh-release`) to commit SHAs. (M)
38. Narrow `check-upstream.yml` permissions (`actions: write` +
    `contents: write` + `pull-requests: write` at workflow level); move to
    job level and document why each is needed. (M)
39. Validate fetched upstream JSON (required-key sanity check; route
    unusually large diffs to human review instead of auto-merge). (M)
40. Use `env:` instead of direct `${{ }}` interpolation in the
    `gh pr merge` run step of check-upstream.yml. (S)
41. Add `audit/` to `.vscodeignore` so fixtures/expectations don't ship in
    the .vsix; periodically verify contents with `vsce ls`. (S)
42. Marketplace metadata in package.json: `icon`, `keywords`,
    `galleryBanner`, `bugs`, `homepage`. (S)
43. Decide and document Marketplace/Open VSX publishing (manual `vsce
    publish` procedure, or automate with `VSCE_PAT`/`OVSX_PAT` on tag). (M)
44. Pin gopls version in CI (今は `@latest`); review the hardcoded
    JetBrains IDE/Gradle versions annually. (S)

## Docs

45. README number drift: "34 semantic entries" (actual 30), "41 colors"
    (actual 43) — fix, or generate the counts at build time. (S)
46. Backfill CHANGELOG.md with the breaking changes users care about
    (0.1.0 Zed-variant retirement, 0.1.1 288→14 rule compression). (M)
47. Add CONTRIBUTING.md (build/audit commands, the PHILOSOPHY
    provenance-ruling rule for color changes) and a PR template. (M)
48. README documents installation for VS Code and JetBrains only; add
    instructions for the Ghostty / Windows Terminal / Vim artifacts the
    build already produces. (S)
49. Add provenance comments to the one-line regression fixtures
    (`test-keywords.ts` etc.) and a realistic TSX fixture with JSX
    attributes/spread/fragments. (S)

## Suggested ordering

1. Quick wins (S, immediate): 1, 3, 6, 7, 9, 13, 15, 21, 40, 41, 42, 45.
2. Close audit false-negative holes: 2, 16, 24, 26.
3. Coverage expansion: 11 → 12 → 25.
4. Long-term: 28 (light variant), 43 (publishing automation).
