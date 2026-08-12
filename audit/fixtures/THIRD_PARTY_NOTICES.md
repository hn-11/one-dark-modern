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
