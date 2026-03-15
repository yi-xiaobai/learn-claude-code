---
description: 自动创建 GitLab Merge Request。基于当前分支和默认目标分支（dev）自动创建 MR。
disable-model-invocation: true
---

# GitLab MR 创建

自动化创建 GitLab Merge Request，避免手动操作。

## 使用方式

```
/devops:mr-create [target_branch]
```

- `target_branch`: 可选，默认 `dev`

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

## 执行步骤

### 步骤 1: 加载配置

```bash
source ~/.claude/skills/mr-create/.env

if [ -z "$GITLAB_TOKEN" ] || [ -z "$GITLAB_HOST" ]; then
    echo "❌ 错误：请先配置 .env 文件"
    exit 1
fi
```

### 步骤 2: 获取当前项目信息

```bash
REMOTE_URL=$(git remote get-url origin)

if [[ $REMOTE_URL == git@* ]]; then
    PROJECT_PATH=$(echo $REMOTE_URL | sed 's|git@[^:]*:||' | sed 's|\.git$||')
else
    PROJECT_PATH=$(echo $REMOTE_URL | sed 's|https\?://[^/]*/||' | sed 's|\.git$||')
fi
```

### 步骤 3: 获取项目 ID 和分支信息

```bash
ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's|/|%2F|g')
PROJECT_INFO=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "https://$GITLAB_HOST/api/v4/projects/$ENCODED_PATH")
PROJECT_ID=$(echo $PROJECT_INFO | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

SOURCE_BRANCH=$(git branch --show-current)
TARGET_BRANCH=${1:-dev}
MR_TITLE=$(git log -1 --pretty=%B | head -n 1)
```

### 步骤 4: 创建 MR

```bash
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
```

## 默认设置

- ✅ **Delete source branch**: 合并后自动删除源分支
- ✅ **Squash commits**: 合并时压缩所有提交为单个提交

## 快速命令

| 用户说 | 执行操作 |
|--------|---------|
| `/devops:mr-create` | 创建到 dev 的 MR |
| `/devops:mr-create master` | 创建到 master 的 MR |
