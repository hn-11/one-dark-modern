// Regression fixture, borrowed from microsoft/vscode colorize-tests
// (extensions/typescript-basics/test/colorize-fixtures, MIT). Guards template
// literals: the `${}` embedded-boundary scope (docs/PHILOSOPHY.md §6), a
// template that spans two lines, and a tagged template with expressions.
var x = `Hello ${foo}!`;
console.log(`string text line 1
string text line 2`);
x = tag`Hello ${ a + b } world ${ a * b }`;