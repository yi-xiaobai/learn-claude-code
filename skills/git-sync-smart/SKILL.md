---
name: git-sync-smart
description: Smart sync - commit and push with intelligent conflict handling
tags: git, sync, commit, push, conflict
---

# Git Smart Sync Skill（智能同步）

一键完成 commit + push，智能处理冲突。

## 完整流程

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: 检查变更                                        │
│  Step 2: 分析并生成 commit message                       │
│  Step 3: 暂存 + 提交                                     │
│  Step 4: 检测远端是否有新提交                             │
│     │                                                    │
│     ├── 无冲突 → 直接推送 → 完成 ✓                        │
│     │                                                    │
│     └── 有冲突 → 进入冲突处理流程                         │
│           │                                              │
│           ├── 1. 创建备份分支                            │
│           ├── 2. 尝试 rebase                             │
│           ├── 3. 自动解决简单冲突                         │
│           ├── 4. 展示 diff 给用户 review                 │
│           ├── 5. 用户确认后推送                          │
│           └── 6. 如不满意，回滚到备份                     │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: 检查变更状态

```bash
git status
git diff --stat
```

如果没有变更，提示用户并结束。

## Step 2: 查看具体变更并生成提交信息

```bash
git diff
```

根据变更内容生成 Conventional Commits 格式的提交信息：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档变更
- `style`: 代码格式
- `refactor`: 重构
- `chore`: 构建/工具变更

## Step 3: 暂存并提交

```bash
git add .
git commit -m "<type>(<scope>): <description>"
```

## Step 4: 检测远端状态

```bash
# 获取远端最新信息
git fetch origin

# 获取当前分支名
BRANCH=$(git branch --show-current)

# 检查远端是否有新提交
git log HEAD..origin/$BRANCH --oneline
```

---

## 情况 A: 无冲突（远端无新提交）

直接推送：

```bash
git push origin $BRANCH
```

验证成功：

```bash
git log origin/$BRANCH -1 --oneline
echo "✅ 同步成功！"
```

---

## 情况 B: 有冲突（远端有新提交）

### B.1 创建备份分支

```bash
BACKUP_BRANCH="backup/$(git branch --show-current)-$(date +%Y%m%d-%H%M%S)"
git branch $BACKUP_BRANCH
echo "📦 已创建备份分支: $BACKUP_BRANCH"
```

### B.2 尝试 Rebase

```bash
git pull --rebase origin $BRANCH
```

### B.3 检查是否有冲突

```bash
# 如果 rebase 成功（无冲突）
git status
```

**如果无冲突**：继续推送

```bash
git push origin $BRANCH
echo "✅ Rebase 成功，已推送！"
```

**如果有冲突**：进入冲突处理流程

### B.4 冲突处理流程

```bash
# 查看冲突文件
git diff --name-only --diff-filter=U

# 查看具体冲突内容
git diff
```

**展示给用户 Review**：
- 列出所有冲突文件
- 显示冲突的具体内容（<<<<<<< HEAD ... =======  ... >>>>>>>）
- 询问用户如何处理

**用户选项**：
1. **接受当前版本** (ours): `git checkout --ours <file>`
2. **接受远端版本** (theirs): `git checkout --theirs <file>`
3. **手动编辑**: 用户自行修改冲突文件
4. **放弃操作**: 回滚到备份

### B.5 解决冲突后

```bash
# 标记冲突已解决
git add .

# 继续 rebase
git rebase --continue

# 推送
git push origin $BRANCH

echo "✅ 冲突已解决，推送成功！"
```

### B.6 如果用户不满意，回滚到备份

```bash
# 放弃当前 rebase
git rebase --abort

# 回到备份分支
git checkout $BACKUP_BRANCH

# 删除失败的提交（如果需要）
git branch -D $BRANCH
git checkout -b $BRANCH

echo "↩️ 已回滚到备份状态"
```

---

## 快速命令参考

```bash
# 一键同步（无冲突时）
git add . && git commit -m "chore: update" && git pull --rebase && git push

# 查看冲突文件
git diff --name-only --diff-filter=U

# 接受所有本地版本
git checkout --ours .

# 接受所有远端版本
git checkout --theirs .

# 放弃 rebase
git rebase --abort
```

---

## 注意事项

- ⚠️ 推送前确保代码可运行
- ⚠️ 避免提交敏感信息（.env、密钥等）
- ⚠️ 冲突解决后务必测试代码
- 💡 备份分支可在确认无误后删除：`git branch -D $BACKUP_BRANCH`
