// Regression fixture, borrowed from microsoft/vscode colorize-tests
// (extensions/typescript-basics/test/colorize-fixtures, MIT). Guards class
// member scopes: an access modifier, a typed+initialized field, and a method
// whose parameter carries a type annotation.
class A2 extends B1 {
	public count: number = 9;
	public resolveNextGeneration(cell : A2) {
	}
}