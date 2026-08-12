# Regression fixture for microsoft/vscode#173224 (shell-unix-bash grammar).
# An alias name containing a hyphen must tokenize exactly like the underscore
# form; the grammar used to stop matching the alias at the `-`.
alias brew_list="brew leaves"
alias brew-list="brew leaves"
