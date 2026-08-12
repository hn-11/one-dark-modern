# Contributing

## Requirements

- Node.js **>= 23.6** — scripts under `scripts/` run as native TypeScript
  (no build step, no `ts-node`).

## Commands

```sh
npm ci
npm run build       # regenerate themes/ (and jetbrains/ghostty/windows-terminal/vim artifacts)
npm run typecheck   # tsc --noEmit
npm run audit        # flicker audit: TextMate + real LSPs (gopls, typescript-language-server)
npm run oracle       # dumps the real engine's resolution of every fixture token/selector
```

`npm run audit` also runs in CI. If it flags a token whose color changes
between TextMate and semantic highlighting, either fix the rule or, if the
repaint is intentional, add a reasoned entry to `audit/allow.json`.

The JetBrains headless audit lives under `jetbrains-audit/` and is run
separately (see README.md) — it is not part of `npm run audit`.

## Changing a syntax color

`syntax/` (the TextMate rules in `tokens.json`, the semantic entries in
`semantic.json`, and the vocabulary in `families.json`) has **no
upstream** — it is this repository's own source of truth. Any change to a
syntax color is therefore a provenance decision, not a stylistic one:

- Read [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md), particularly §3
  ("Provenance: a color's authority is its history") and the five
  witnesses it scores evidence against (TextMate-era Atom, tree-sitter-era
  Atom, base16, Zed, and the official tree-sitter grammar queries), plus
  the ecosystem check it uses when those witnesses leave a thin margin.
- A color change must be backed by that evidence, not by "it was in One
  Dark Pro" or personal preference alone.
- Record the ruling — the evidence considered and the decision reached —
  in §6 of `docs/PHILOSOPHY.md` ("The rulings, by token family"), the same
  way existing rulings are documented there. A syntax color change without
  a corresponding provenance ruling will not be merged.
- The build rejects any token or semantic entry whose color falls outside
  the ten-family vocabulary in `syntax/families.json` — new colors aren't
  an option; only the existing families.
- Run `npm run audit` and, if you touch `syntax/` in a way that could
  change resolution, `npm run oracle` before and after to confirm the
  change is either the intended visible diff or provably invisible.

## UI-layer (`overrides/`) changes

These track Dark Modern / 2026 Dark upstream and don't need a provenance
ruling, but should still explain *why* the override deviates from
upstream in the commit message.
