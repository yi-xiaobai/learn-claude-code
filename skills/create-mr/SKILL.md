---
name: create-mr
description: 自动创建 GitLab Merge Request。当用户说"创建MR"、"create-mr"、"提交MR"、"开一个MR"时使用此技能。基于当前分支和默认目标分支（dev）自动创建 MR，使用最后一个 commit message 作为标题。
---

# GitLab Merge Request 自动创建

这个技能用于自动化创建 GitLab Merge Request，避免手动操作。

## 工作流程

1. **获取当前项目信息**: 从 git remote 获取 GitLab 项目路径
2. **获取项目 ID**: 通过 GitLab API 查询项目 ID
3. **获取分支信息**: 当前分支（源分支）和目标分支
4. **获取 MR 标题**: 使用最后一个 commit message
5. **创建 MR**: 调用 GitLab API 创建 Merge Request

## 配置要求

在技能目录下创建 `.env` 文件：

```bash
GITLAB_TOKEN=your_gitlab_token_here
GITLAB_HOST=your-gitlab.company.com
```

**获取 GitLab Token**：
1. 登录 GitLab → Preferences → Access Tokens
2. 创建 Token，勾选 `api` 权限
3. 复制 Token 到 `.env` 文件

## 执行步骤

### 步骤 1: 加载配置

```bash
# 读取 .env 文件
source ~/.claude/skills/create-mr/.env

# 验证必要的环境变量
if [ -z "$GITLAB_TOKEN" ] || [ -z "$GITLAB_HOST" ]; then
    echo "❌ 错误：请先配置 .env 文件"
    exit 1
fi
```

### 步骤 2: 获取当前项目信息

```bash
# 获取 git remote URL
REMOTE_URL=$(git remote get-url origin)

# 解析 GitLab 项目路径
# 支持两种格式：
# - git@your-gitlab.company.com:group/project.git
# - https://your-gitlab.company.com/group/project.git

if [[ $REMOTE_URL == git@* ]]; then
    # SSH 格式: git@your-gitlab.company.com:group/project.git
    PROJECT_PATH=$(echo $REMOTE_URL | sed 's|git@[^:]*:||' | sed 's|\.git$||')
else
    # HTTPS 格式: https://your-gitlab.company.com/group/project.git
    PROJECT_PATH=$(echo $REMOTE_URL | sed 's|https\?://[^/]*/||' | sed 's|\.git$||')
fi

echo "📁 项目路径: $PROJECT_PATH"
```

### 步骤 3: 获取项目 ID

```bash
# URL encode 项目路径
ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's|/|%2F|g')

# 调用 GitLab API 获取项目信息
PROJECT_INFO=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "https://$GITLAB_HOST/api/v4/projects/$ENCODED_PATH")

# 提取项目 ID
PROJECT_ID=$(echo $PROJECT_INFO | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

if [ -z "$PROJECT_ID" ]; then
    echo "❌ 错误：无法获取项目 ID"
    echo "请检查："
    echo "1. GitLab Token 是否正确"
    echo "2. 是否有访问该项目的权限"
    exit 1
fi

echo "🆔 项目 ID: $PROJECT_ID"
```

### 步骤 4: 获取分支信息

```bash
# 获取当前分支（源分支）
SOURCE_BRANCH=$(git branch --show-current)

# 目标分支（可通过参数指定，默认为 dev）
TARGET_BRANCH=${1:-dev}

echo "🌿 源分支: $SOURCE_BRANCH"
echo "🎯 目标分支: $TARGET_BRANCH"

# 检查是否已经在目标分支上
if [ "$SOURCE_BRANCH" == "$TARGET_BRANCH" ]; then
    echo "❌ 错误：当前已在目标分支 $TARGET_BRANCH 上"
    exit 1
fi
```

### 步骤 5: 获取 MR 标题

```bash
# 获取最后一个 commit message
COMMIT_MESSAGE=$(git log -1 --pretty=%B | head -n 1)

# 作为 MR 标题
MR_TITLE="$COMMIT_MESSAGE"

echo "📝 MR 标题: $MR_TITLE"
```

### 步骤 6: 创建 Merge Request

```bash
# 调用 GitLab API 创建 MR
RESPONSE=$(curl -s --request POST \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    --header "Content-Type: application/json" \
    --data "{
        \"source_branch\": \"$SOURCE_BRANCH\",
        \"target_branch\": \"$TARGET_BRANCH\",
        \"title\": \"$MR_TITLE\",
        \"remove_source_branch\": true,
        \"squash\": true
    }" \
    "https://$GITLAB_HOST/api/v4/projects/$PROJECT_ID/merge_requests")

# 检查是否成功
MR_IID=$(echo $RESPONSE | grep -o '"iid":[0-9]*' | grep -o '[0-9]*')

if [ -n "$MR_IID" ]; then
    MR_URL="https://$GITLAB_HOST/$PROJECT_PATH/-/merge_requests/$MR_IID"
    echo "✅ MR 创建成功！"
    echo "🔗 MR 链接: $MR_URL"

    # 尝试打开浏览器
    if command -v open &> /dev/null; then
        open "$MR_URL"
    fi
else
    echo "❌ MR 创建失败"
    echo "响应: $RESPONSE"

    # 检查常见错误
    if echo $RESPONSE | grep -q "already exists"; then
        echo "💡 提示：该分支的 MR 已存在"
    fi
fi
```

## 使用示例

### 基本用法（默认目标分支 dev）

```bash
# 用户说："创建MR"
# 执行：创建从当前分支到 dev 的 MR
```

### 指定目标分支

```bash
# 用户说："创建MR 到 master"
# 执行：创建从当前分支到 master 的 MR
```

## 错误处理

技能会在以下情况停止并提示用户：

1. **配置缺失**: `.env` 文件不存在或 Token 未配置
2. **权限问题**: 无法访问项目（Token 无权限）
3. **分支错误**: 当前已在目标分支上
4. **MR 已存在**: 该源分支到目标分支的 MR 已经存在
5. **网络问题**: 无法连接到 GitLab API

## 注意事项

1. **Token 安全**: 不要将 `.env` 文件提交到版本控制
2. **权限要求**: Token 需要 `api` 权限
3. **分支推送**: 确保当前分支已推送到远端
4. **默认设置**:
   - ✅ **Delete source branch**: 合并后自动删除源分支
   - ✅ **Squash commits**: 合并时压缩所有提交为单个提交

## 快速命令

| 用户说 | 执行操作 |
|--------|---------|
| "创建MR" | 创建到 dev 的 MR |
| "create-mr" | 同上 |
| "创建MR 到 master" | 创建到 master 的 MR |
| "提交MR" | 同创建MR |
