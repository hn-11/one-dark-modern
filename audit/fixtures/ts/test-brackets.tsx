// Regression fixture, borrowed from microsoft/vscode colorize-tests
// (extensions/typescript-basics/test/colorize-fixtures, MIT). Guards the
// generics-vs-JSX ambiguity in .tsx: `Array<number>` must tokenize as a type
// with type arguments, not as a JSX tag that swallows the following lines.
let a = Array<number>();   // Highlight ok here

interface egGenericsInArray {
   a: Array<number>;
}
let s = "nothing should fail here...";