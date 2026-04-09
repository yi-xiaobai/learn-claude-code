#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ACTION="$1"
BRANCH_NAME="$2"

# 参数校验
if [ -z "$ACTION" ]; then
    echo "用法: $0 {build|publish|build-publish} <branch>"
    exit 1
fi

if [ -z "$BRANCH_NAME" ]; then
    echo "❌ 分支名不能为空"
    exit 1
fi

# 获取项目路径并进入
TURTLE_PATH=$(get_turtle_path) || exit 1
cd "$TURTLE_PATH"

# 公共操作
do_git_prepare() {
    git fetch
    git checkout "$BRANCH_NAME"
}

do_build() {
    yarn build
}

do_publish() {
    check_npm_login "$TURTLE_PATH" || exit 1
    npm version patch --no-git-tag-version
    npm publish || (rm -f ~/.nvmrc && npm publish)
}

do_git_push() {
    git add .
    git commit -m "$1"
    git push
}

# 执行操作
case "$ACTION" in
    build)
        do_git_prepare
        do_build
        do_git_push "chore(build): update dist bundle"
        echo "✅ 构建完成！"
        ;;
        
    publish)
        do_git_prepare
        do_publish
        do_git_push "chore(release): bump version"
        echo "✅ 发布完成！"
        ;;
        
    build-publish)
        do_git_prepare
        do_build
        do_publish
        do_git_push "chore(release): bump version and update dist"
        echo "✅ 构建发布完成！"
        ;;
        
    *)
        echo "❌ 未知操作: $ACTION"
        echo "用法: $0 {build|publish|build-publish} <branch>"
        exit 1
        ;;
esac
