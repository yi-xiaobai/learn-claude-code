#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

BRANCH_NAME="$1"
VERSION_BUMP="${2:-patch}"

if [ -z "$BRANCH_NAME" ]; then
    echo "用法: $0 <branch> [patch|minor|major]"
    exit 1
fi

TURTLE_PATH=$(get_turtle_path) || exit 1
cd "$TURTLE_PATH"

do_git_prepare() {
    git fetch
    git checkout "$BRANCH_NAME"
}

do_build() {
    yarn build
}

do_version() {
    npm version "$VERSION_BUMP" --no-git-tag-version
}

do_git_push() {
    git add .
    git commit -m "$1"
    git push
}

case "$VERSION_BUMP" in
    patch|minor|major)
        ;;
    *)
        echo "❌ 版本升级类型无效: $VERSION_BUMP"
        echo "可选值: patch | minor | major"
        exit 1
        ;;
esac

do_git_prepare
do_build
do_version
do_git_push "chore(release): bump version and update dist"
echo "✅ 构建并升级版本完成！"
