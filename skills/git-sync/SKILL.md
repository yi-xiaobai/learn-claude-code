---
name: git-sync
description: One-click sync - add, commit, and push all changes
tags: git, sync, quick
---

# Git Sync Skill（一键同步）

当需要快速同步代码到远端时，按以下步骤一次性完成：

## Step 1: 检查变更
```bash
git status
git diff --stat
```

## Step 2: 分析变更内容
```bash
git diff
```

根据变更生成合适的提交信息。

## Step 3: 一键同步
```bash
# 暂存所有变更
git add .

# 提交（根据变更内容生成信息）
git commit -m "<type>(<scope>): <description>"

# 拉取远端最新（避免冲突）
git pull --rebase origin $(git branch --show-current)

# 推送到远端
git push origin $(git branch --show-current)
```

## Step 4: 验证同步成功
```bash
git status
git log origin/$(git branch --show-current) -1 --oneline
```

## 快速命令（适合简单变更）
```bash
git add . && git commit -m "chore: update" && git pull --rebase && git push
```

## 注意事项
- 推送前确保代码可运行
- 避免提交敏感信息（.env、密钥等）
- 大型变更建议分多次提交
