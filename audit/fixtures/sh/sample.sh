#!/usr/bin/env bash
set -euo pipefail

VERSION="0.0.21"
git commit --amend --no-edit
npm version patch --no-git-tag-version
code --install-extension "one-dark-modern-${VERSION}.vsix"
echo "released ${VERSION}" | tee release.log
if [ -f release.log ]; then
  rm -f release.log
fi
