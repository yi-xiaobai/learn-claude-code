#!/bin/bash

# ============================================================
# create-branch.sh - 自动创建分支并打开 Windsurf IDE
# 
# 使用方法:
#   ./create-branch.sh feat    # 创建新功能分支
#   ./create-branch.sh fix     # 创建 bug 修复分支
#   ./create-branch.sh hotfix  # 同 fix
#
# 配置: 修改 projects.conf 添加新项目
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$(dirname "$SCRIPT_DIR")/projects.conf"

# ============ GitLab 配置 (从 .env 读取) ============
# .env 在 scripts 目录的上一级
ENV_FILE="$(dirname "$SCRIPT_DIR")/.env"
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
else
  echo -e "${RED}❌ 配置文件 .env 不存在${NC}"
  echo "请复制 .env.example 为 .env 并填入你的 GitLab Token"
  exit 1
fi
# =================================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 参数检查
BRANCH_TYPE=$1
PROJECT_ALIAS=$2
BASE_BRANCH_ARG=$3  # 可选：指定基础分支

if [ -z "$BRANCH_TYPE" ]; then
  echo -e "${RED}❌ 请指定分支类型: feat / fix / hotfix${NC}"
  echo ""
  echo "使用方法:"
  echo "  $0 feat                              # 新功能（自动选择匹配的项目）"
  echo "  $0 feat <项目别名>                   # 新功能，指定项目"
  echo "  $0 feat <项目别名> <基础分支>         # 新功能，指定项目和基础分支"
  echo "  $0 fix                               # Bug修复"
  echo "  $0 fix <项目别名>                    # Bug修复，指定项目"
  echo "  $0 fix <项目别名> <基础分支>          # Bug修复，指定项目和基础分支"
  echo "  $0 hotfix                            # 线上问题"
  echo ""
  echo "可用项目别名:"
  echo "  master-web  mg-oncall  (其他自定义项目)"
  echo ""
  echo "示例:"
  echo "  $0 fix mg-oncall dev    # 基于 dev 分支创建 fix 分支"
  exit 1
fi

# 标准化分支类型
case "$BRANCH_TYPE" in
  feat|feature)
    BRANCH_TYPE="feat"
    TYPE_FILTER="feat"
    ;;
  fix|bug)
    BRANCH_TYPE="fix"
    TYPE_FILTER="fix"
    ;;
  hotfix|online)
    BRANCH_TYPE="fix"
    TYPE_FILTER="fix"
    ;;
  *)
    echo -e "${RED}❌ 未知的分支类型: $BRANCH_TYPE${NC}"
    echo "支持的类型: feat, fix, hotfix"
    exit 1
    ;;
esac

# 读取配置文件，找到匹配的项目
if [ ! -f "$CONFIG_FILE" ]; then
  echo -e "${RED}❌ 配置文件不存在: $CONFIG_FILE${NC}"
  exit 1
fi

# 解析配置文件
PROJECT_PATH=""
PROJECT_ID=""
BRANCH_PREFIX=""
PROJECT_NAME=""

while IFS='|' read -r name path pid prefix types || [ -n "$name" ]; do
  # 跳过注释和空行
  [[ "$name" =~ ^#.*$ ]] && continue
  [[ -z "$name" ]] && continue

  # 如果指定了项目别名，精确匹配
  if [ -n "$PROJECT_ALIAS" ]; then
    if [[ "$name" == "$PROJECT_ALIAS" ]]; then
      PROJECT_PATH="$path"
      PROJECT_ID="$pid"
      BRANCH_PREFIX="${BRANCH_TYPE}_${prefix}_v"
      PROJECT_NAME="$name"
      break
    fi
    continue
  fi

  # 没有指定项目别名，检查类型是否匹配
  if [[ "$types" == "all" ]] || [[ "$types" == "$TYPE_FILTER" ]]; then
    PROJECT_PATH="$path"
    PROJECT_ID="$pid"
    BRANCH_PREFIX="${BRANCH_TYPE}_${prefix}_v"
    PROJECT_NAME="$name"
    break
  fi
done < "$CONFIG_FILE"

if [ -z "$PROJECT_PATH" ]; then
  if [ -n "$PROJECT_ALIAS" ]; then
    echo -e "${RED}❌ 没有找到项目: $PROJECT_ALIAS${NC}"
    echo "请检查 projects.conf 中的配置"
  else
    echo -e "${RED}❌ 没有找到匹配 '$BRANCH_TYPE' 类型的项目配置${NC}"
  fi
  exit 1
fi

echo -e "${BLUE}📦 项目: $PROJECT_NAME${NC}"

echo -e "${BLUE}📁 项目目录: $PROJECT_PATH${NC}"
echo -e "${BLUE}🔖 分支前缀: $BRANCH_PREFIX${NC}"

# 切换到项目目录
cd "$PROJECT_PATH" || { echo -e "${RED}❌ 无法进入目录: $PROJECT_PATH${NC}"; exit 1; }

# 确定基础分支：优先使用参数指定 > .env 中的 BASE_BRANCH
if [ -n "$BASE_BRANCH_ARG" ]; then
  echo -e "${BLUE}🌿 指定基础分支: $BASE_BRANCH_ARG${NC}"
  BASE_BRANCH=$BASE_BRANCH_ARG
else
  echo -e "${BLUE}🌿 使用默认基础分支: $BASE_BRANCH${NC}"
fi

# 获取最大版本号
echo -e "${YELLOW}🔍 正在查找最大版本号...${NC}"

MAX_VERSION=-1

# 扫描本地分支
for branch in $(git branch --list "${BRANCH_PREFIX}*" 2>/dev/null | sed 's/^[* ]*//'); do
  VERSION=$(echo "$branch" | sed "s/${BRANCH_PREFIX}//" | grep -E '^[0-9]+$')
  if [ -n "$VERSION" ] && [ "$VERSION" -gt "$MAX_VERSION" ]; then
    MAX_VERSION=$VERSION
  fi
done

# 计算新版本号
NEW_VERSION=$((MAX_VERSION + 1))
NEW_BRANCH="${BRANCH_PREFIX}${NEW_VERSION}"

echo -e "${BLUE}📊 当前最大版本: v$MAX_VERSION${NC}"
echo -e "${GREEN}🆕 新分支名称: $NEW_BRANCH${NC}"
echo ""

# 检测本地改动并暂存
echo -e "${YELLOW}🔍 正在检测本地改动...${NC}"
STASH_REF=""
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}📦 检测到未提交改动，正在暂存...${NC}"
  STASH_MARKER="auto-stash:$NEW_BRANCH:$(date +%s)"
  git stash push -u -m "$STASH_MARKER" >/dev/null 2>&1
  STASH_REF=$(git stash list --pretty="%gd %s" | grep -F -- "$STASH_MARKER" | head -n1 | awk '{print $1}')
fi

# 通过 GitLab API 创建远程分支
echo -e "${YELLOW}🌐 正在通过 GitLab API 创建远程分支...${NC}"
RESPONSE=$(curl --silent --request POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$GITLAB_HOST/api/v4/projects/$PROJECT_ID/repository/branches?branch=$NEW_BRANCH&ref=$BASE_BRANCH")

if echo "$RESPONSE" | grep -q "\"name\":\"$NEW_BRANCH\""; then
  echo -e "${GREEN}✅ 远程分支 '$NEW_BRANCH' 创建成功${NC}"
elif echo "$RESPONSE" | grep -q "already exists"; then
  echo -e "${YELLOW}⚠️  远程分支 '$NEW_BRANCH' 已存在${NC}"
else
  echo -e "${YELLOW}⚠️  GitLab API 响应: $RESPONSE${NC}"
  echo "   将尝试只创建本地分支..."
fi

# 更新本地仓库
echo -e "${YELLOW}🔄 正在更新本地仓库...${NC}"
git fetch origin

# 创建/切换本地分支
if git show-ref --verify --quiet refs/heads/$NEW_BRANCH; then
  echo -e "${BLUE}📌 本地分支已存在，正在切换...${NC}"
  git checkout $NEW_BRANCH
else
  if git show-ref --verify --quiet refs/remotes/origin/$NEW_BRANCH; then
    echo -e "${BLUE}📥 从远程分支创建本地分支...${NC}"
    git checkout -b $NEW_BRANCH origin/$NEW_BRANCH
  else
    echo -e "${BLUE}🆕 创建新的本地分支...${NC}"
    git checkout -b $NEW_BRANCH
    git branch --set-upstream-to=origin/$NEW_BRANCH $NEW_BRANCH 2>/dev/null || true
  fi
fi

echo -e "${GREEN}✅ 已切换到分支: $(git branch --show-current)${NC}"

# 还原暂存的改动
if [ -n "$STASH_REF" ]; then
  echo -e "${YELLOW}📦 正在还原暂存的改动...${NC}"
  if ! git stash pop "$STASH_REF" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  stash pop 发生冲突，请手动处理${NC}"
  fi
fi

# 打开 Windsurf IDE
echo ""
echo -e "${BLUE}🚀 正在使用 Windsurf 打开项目...${NC}"
open -a "Windsurf" "$PROJECT_PATH"

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}✅ 完成！${NC}"
echo -e "${GREEN}   分支: $NEW_BRANCH${NC}"
echo -e "${GREEN}   项目: $PROJECT_PATH${NC}"
echo -e "${GREEN}==========================================${NC}"
