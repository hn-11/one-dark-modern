# One Dark Modern

A color theme inspired by Atom One Dark and Dark Modern.

Setext heading level one
========================

Setext heading level two
------------------------

## Installation

Install from the Marketplace, then pick **One Dark Modern** in the theme
picker. You can also use *One Dark 2026*, which shares the exact same
_syntax layer_ and only differs in the workbench colors. Inline code such as
`npm run audit` and ``a literal `backtick` inside`` is raw markup.

Some ~~struck-through~~ text, a hard break at the end of this line,
and a trailing line.

### Links and images

- A plain link: [the repository](https://github.com/hn-11/one-dark-modern)
- A link with a title: [issues](https://github.com/hn-11/one-dark-modern/issues "Bug tracker")
- A reference link: [philosophy][phil]
- An image: ![screenshot of the theme](docs/screenshot.png "One Dark Modern")
- An autolink: <https://code.visualstudio.com>

[phil]: docs/PHILOSOPHY.md "Theme doctrine"

### Lists

1. Build the themes
2. Run the flicker audit
3. Snapshot the oracle

* Unordered with an asterisk
+ Unordered with a plus
- Unordered with a hyphen
  - Nested item
    1. Deeply nested ordered item

- [ ] An unchecked task
- [x] A checked task

> A blockquote about the doctrine:
> lexically unambiguous parts belong to TextMate; the semantic layer may
> only fill in what TextMate could not decide.
>
> > A nested blockquote.

### Fenced code

```bash
export PATH="$PATH:$HOME/go/bin"
npm run audit -- --update
```

```json
{ "workbench.colorTheme": "One Dark Modern", "editor.fontSize": 13 }
```

```ts
const theme: string = "one-dark-modern";
export function activate(): void {
  console.log(`loaded ${theme}`);
}
```

    an indented code block
    on two lines

### Table

| Language | Grammar          | Semantic server |
| -------- | ---------------- | --------------- |
| Go       | `source.go`      | gopls           |
| YAML     | `source.yaml`    | none            |
| Markdown | `text.html.mark` | none            |

### Misc

Here is an HTML block:

<div align="center">
  <img src="docs/logo.png" alt="logo" width="120">
</div>

An entity: &copy; &amp; &#169;. A horizontal rule follows.

---

Footnote-ish reference[^1] and a final paragraph.

[^1]: Not every renderer supports these.
