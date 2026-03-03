---
name: git-push
description: Push commits to remote repository safely
tags: git, push, remote
---

# Git Push Skill

当需要推送代码到远端时，按以下步骤操作：

## Step 1: 检查当前分支状态
```bash
git branch --show-current
git status
```

## Step 2: 检查远端状态
```bash
# 获取远端最新信息
git fetch origin

# 查看本地与远端的差异
git log origin/$(git branch --show-current)..HEAD --oneline
```

## Step 3: 检查是否需要先拉取
```bash
# 查看远端是否有新提交
git log HEAD..origin/$(git branch --show-current) --oneline
```

如果远端有新提交，先执行：
```bash
git pull --rebase origin $(git branch --show-current)
```

## Step 4: 推送到远端
```bash
# 普通推送
git push origin $(git branch --show-current)

# 如果是新分支，需要设置上游
git push -u origin $(git branch --show-current)
```

## Step 5: 验证推送成功
```bash
git log origin/$(git branch --show-current) -1 --oneline
```

## 常见问题处理

### 推送被拒绝（远端有新提交）
```bash
git pull --rebase origin $(git branch --show-current)
git push origin $(git branch --show-current)
```

### 强制推送（谨慎使用）
```bash
git push --force-with-lease origin $(git branch --show-current)
```
