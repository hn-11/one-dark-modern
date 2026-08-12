// Regression fixture, borrowed from microsoft/vscode colorize-tests
// (extensions/typescript-basics/test/colorize-fixtures, MIT). Guards nested
// object-literal keys, which must stay in the red key family
// (docs/PHILOSOPHY.md §2) rather than drifting to plain or property colors.
let s1 = {
	k: {
		k1: s,
		k2: 1
	}
};