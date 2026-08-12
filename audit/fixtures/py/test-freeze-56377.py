# Regression fixture for microsoft/vscode#56377 (MagicPython tokenizer freeze).
# Kept as a performance/termination guard: a dict comprehension inside a dict
# literal, followed by a .format() string containing escaped quotes, braces and
# a line continuation - the shape that used to hang the grammar.
record = {
    "headers": {k: str(v) for k, v in self.request.META.items() if k.startswith('HTTP_')}
}
cmd = "git-clang-format --style=\"{{BasedOnStyle: Google, ColumnLimit: 100, IndentWidth: 2, " \ "AlignConsecutiveAssignments: true}}\" {COMMIT_SHA} -- ./**/*.proto > {OUTPUT}".format(