#!/usr/bin/env bash

set -o verbose
set -o xtrace
set -o errexit

issemver=$(./scripts/check-semver.sh -t "$TAG_NAME")
currenttag=$(npm pkg get version)

git config user.name github-actions
git config user.email github-actions@github.com

if [ "$issemver" -eq "1" ]; then
    if ! [ "$currenttag" = "\"$TAG_NAME\"" ]; then
        echo "Branch tag is different than packge.json version. Updating package.json version to $TAG_NAME"

        INIT_HEAD=$(git describe --exact-match --tags)
        git fetch origin master --depth 1
        git switch master
        npm version --allow-same-version "$TAG_NAME"
        git push --no-verify

        git checkout "tags/$INIT_HEAD"
        npm version --allow-same-version --git-tag-version=false "$TAG_NAME"
    fi

    echo "Publishing to npm"
    npm publish
fi
