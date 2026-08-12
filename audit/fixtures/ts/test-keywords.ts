// Regression fixture, borrowed from microsoft/vscode colorize-tests
// (extensions/typescript-basics/test/colorize-fixtures, MIT). Guards that
// `new` stays a word-keyword and `=>` an operator, and that RegExp('') is a
// call - not the start of a regex literal that swallows the rest of the line.
export var foo = () => new RegExp('');
