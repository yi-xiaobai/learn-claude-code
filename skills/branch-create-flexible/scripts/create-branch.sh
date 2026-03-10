#!/bin/bash
# 分支创建辅助脚本
# 用法: ./create-branch.sh <type> [base_branch] [ide]

TYPE="${1:-feat}"
BASE_BRANCH="${2:-dev}"
IDE="${3:-windsurf}"
PROJECT_PATH="${4:-.}"

# 生成分支名
TIMESTAMP=$(date +%Y%m%d%H%M)
BRANCH_NAME="${TYPE}/auto-${TIMESTAMP}"

echo "创建分支: $BRANCH_NAME (基于 $BASE_BRANCH)"

# 创建分支
cd "$PROJECT_PATH"
git fetch origin
git checkout -b "$BRANCH_NAME" "origin/$BASE_BRANCH"

# 打开 IDE
case "$IDE" in
  vscode)
    code "$PROJECT_PATH"
    ;;
  windsurf|*)
    # Windsurf 可能不是命令行命令，尝试 code 或 fallback
    command -v windsurf >/dev/null 2>&1 && windsurf "$PROJECT_PATH" || code "$PROJECT_PATH"
    ;;
esac

echo "✅ 分支 $BRANCH_NAME 已创建并用 $IDE 打开"
