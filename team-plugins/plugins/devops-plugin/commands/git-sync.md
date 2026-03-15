---
description: Smart sync - 一键 commit + push，智能处理冲突
disable-model-invocation: true
---

# Git Smart Sync（智能同步）

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
└─────────────────────────────────────────────────────────┘
```

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

## Step 4: 检测远端状态并推送

```bash
git fetch origin
BRANCH=$(git branch --show-current)
git log HEAD..origin/$BRANCH --oneline
```

### 无冲突时

```bash
git push origin $BRANCH
echo "✅ 同步成功！"
```

### 有冲突时

1. 创建备份分支
2. 尝试 rebase
3. 展示冲突给用户
4. 用户选择解决方式
5. 推送或回滚

## 快速命令参考

```bash
# 一键同步（无冲突时）
git add . && git commit -m "chore: update" && git pull --rebase && git push

# 查看冲突文件
git diff --name-only --diff-filter=U

# 放弃 rebase
git rebase --abort
```

## 注意事项

- ⚠️ 推送前确保代码可运行
- ⚠️ 避免提交敏感信息（.env、密钥等）
- ⚠️ 冲突解决后务必测试代码
