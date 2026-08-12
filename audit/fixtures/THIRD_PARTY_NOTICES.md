# Third-Party Notices

Some files under `audit/fixtures/` were borrowed, unmodified or lightly
trimmed, from [microsoft/vscode](https://github.com/microsoft/vscode)'s
`colorize-tests` fixture suite (used by VS Code's own tokenizer/colorizer
tests) rather than written for this repository. They are used here purely
as tokenizer/LSP stress inputs for `npm run audit` and `npm run oracle` —
no VS Code product code is vendored.

microsoft/vscode is MIT-licensed, Copyright (c) Microsoft Corporation. The
license text is reproduced in full below.

## Fixtures that appear to be borrowed

Identified by name (`colorize*` directories, `test-<issue-number>` /
`test<issue-number>` filenames matching VS Code issue numbers) and by
content that doesn't relate to anything else in this repository:

- `audit/fixtures/go/colorize/test.go`
- `audit/fixtures/go/colorize13777/test.go` (and its `go.mod`)
- `audit/fixtures/js/test6916.js`
- `audit/fixtures/py/test-freeze-56377.py`
- `audit/fixtures/sh/test-173216.sh`
- `audit/fixtures/sh/test-173224.sh`
- `audit/fixtures/sh/test-173336.sh`

`audit/fixtures/ts/test.regexp.ts` also looks likely to be adapted from the
same suite (regexp edge cases used to test TextMate regex-scope colorizing)
but this could not be confirmed with certainty, so it is listed here rather
than above; treat it as possibly-borrowed.

## Fixtures believed to be hand-written for this repository

Everything else under `audit/fixtures/` — including `go/base/`,
`js/test.js`, `js/test.jsx`, `py/sample.py`, `py/test.py`, `sh/sample.sh`,
`sh/test.sh`, and the `ts/` files not listed above (`sample.ts`,
`test-brackets.tsx`, `test-keywords.ts`, `test-members.ts`,
`test-object-literals.ts`, `test-strings.ts`, `test.ts`,
`real-build-jetbrains.ts`) — appears to have been written specifically to
exercise this theme's own scope/family rules and is not attributed to
microsoft/vscode.

This attribution was done by inspection (naming convention, issue-number
correlation, content style) rather than by diffing against the upstream
VS Code repository file-for-file, so treat the "borrowed" list above as a
good-faith best effort rather than a guaranteed-exhaustive audit. Corrections
welcome.

## Vendored TextMate grammars (`audit/grammars/`)

Every `*.tmLanguage.json` under `audit/grammars/` except
`toml.tmLanguage.json` (see below) is vendored verbatim from
microsoft/vscode's bundled language extensions (they are the grammars VS Code
actually ships, which is the whole point — the audit must tokenize the way the
editor does). Each file keeps its upstream `information_for_contributors` and
`version` fields, which name the true origin repository and commit; nothing is
modified locally.

| File | Upstream path in microsoft/vscode |
| --- | --- |
| `go.tmLanguage.json` | `extensions/go/syntaxes/go.tmLanguage.json` |
| `TypeScript.tmLanguage.json` | `extensions/typescript-basics/syntaxes/TypeScript.tmLanguage.json` |
| `TypeScriptReact.tmLanguage.json` | `extensions/typescript-basics/syntaxes/TypeScriptReact.tmLanguage.json` |
| `JavaScript.tmLanguage.json` | `extensions/javascript/syntaxes/JavaScript.tmLanguage.json` |
| `JavaScriptReact.tmLanguage.json` | `extensions/javascript/syntaxes/JavaScriptReact.tmLanguage.json` |
| `MagicPython.tmLanguage.json` | `extensions/python/syntaxes/MagicPython.tmLanguage.json` |
| `shell-unix-bash.tmLanguage.json` | `extensions/shellscript/syntaxes/shell-unix-bash.tmLanguage.json` |
| `JSON.tmLanguage.json` | `extensions/json/syntaxes/JSON.tmLanguage.json` |
| `JSONC.tmLanguage.json` | `extensions/json/syntaxes/JSONC.tmLanguage.json` |
| `yaml.tmLanguage.json` | `extensions/yaml/syntaxes/yaml.tmLanguage.json` |
| `yaml-1.3.tmLanguage.json` | `extensions/yaml/syntaxes/yaml-1.3.tmLanguage.json` |
| `yaml-1.2.tmLanguage.json` | `extensions/yaml/syntaxes/yaml-1.2.tmLanguage.json` |
| `yaml-1.1.tmLanguage.json` | `extensions/yaml/syntaxes/yaml-1.1.tmLanguage.json` |
| `yaml-1.0.tmLanguage.json` | `extensions/yaml/syntaxes/yaml-1.0.tmLanguage.json` |
| `yaml-embedded.tmLanguage.json` | `extensions/yaml/syntaxes/yaml-embedded.tmLanguage.json` |
| `markdown.tmLanguage.json` | `extensions/markdown-basics/syntaxes/markdown.tmLanguage.json` |
| `css.tmLanguage.json` | `extensions/css/syntaxes/css.tmLanguage.json` |
| `rust.tmLanguage.json` | `extensions/rust/syntaxes/rust.tmLanguage.json` |
| `cpp.tmLanguage.json` | `extensions/cpp/syntaxes/cpp.tmLanguage.json` |
| `cpp.embedded.macro.tmLanguage.json` | `extensions/cpp/syntaxes/cpp.embedded.macro.tmLanguage.json` |
| `html.tmLanguage.json` | `extensions/html/syntaxes/html.tmLanguage.json` |

`html.tmLanguage.json` is VS Code's `text.html.basic`. It `include`s only
`source.css` and `source.js` (the `<style>` and `<script>` bodies) besides
itself, and both of those grammars were already vendored here, so the HTML
fixture's embedded blocks are tokenized by the same CSS/JavaScript grammars
VS Code uses — no extra sub-grammar had to be vendored for it.

`toml.tmLanguage.json` is the one grammar here that does **not** come from
microsoft/vscode: VS Code ships no TOML extension (there is no
`extensions/toml/` in the repository — verified, the path 404s). It is
vendored verbatim from
[`tamasfe/taplo`](https://github.com/tamasfe/taplo)'s VS Code extension
(`editors/vscode/toml.tmLanguage.json`, scope `source.toml`), i.e. the
Even Better TOML extension — deliberately the same project as the `taplo`
language server the audit runs for TOML semantic tokens, and the origin of
the theme's `tomlArrayKey` semantic rule. taplo is MIT-licensed, Copyright
(c) 2020 Ferenc Tamás; its license text is reproduced at the end of this file.

`cpp.embedded.macro.tmLanguage.json` is likewise not a language of its own:
VS Code's C++ grammar hands the body of a `#define` to it, so `source.cpp`
cannot tokenize a macro definition without it. (Both grammars also `include`
`source.asm`, `source.arm` and `source.glsl` for inline-assembly and shader
blocks; those are deliberately not vendored - no fixture contains inline
assembly, and an unresolved include simply leaves the region untokenized.)

The five `yaml-*` files are not languages of their own: VS Code's YAML grammar
is a dispatcher that `include`s a per-spec-version sub-grammar, so all of them
must be registered for `source.yaml` to tokenize at all.

The JSON/YAML/Markdown/CSS fixtures added alongside them
(`audit/fixtures/json/`, `yaml/`, `md/`, `css/`) are hand-written for this
repository and are not attributed to microsoft/vscode. The same goes for the
Rust and C++ fixtures added for the semantic-coverage work
The HTML and TOML fixtures (`audit/fixtures/html/page.html`,
`audit/fixtures/toml/config.toml`) are likewise hand-written for this
repository. The same goes for the Rust and C++ fixtures added for the
semantic-coverage work (`audit/fixtures/rust/base/` — a minimal cargo project so rust-analyzer has a
workspace to load — and `audit/fixtures/cpp/`, whose `.clangd` file gives
clangd its compile flags without a machine-specific compilation database).

## microsoft/vscode license (MIT)

```
Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```


## tamasfe/taplo license (MIT)

Applies to `audit/grammars/toml.tmLanguage.json` only.

```
MIT License

Copyright (c) 2020 Ferenc Tamás

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
