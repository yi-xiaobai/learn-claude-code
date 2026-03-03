---
name: git-commit
description: Analyze changes and create a well-formatted commit message
tags: git, commit, version-control
---

# Git Commit Skill

当需要提交代码时，按以下步骤操作：

## Step 1: 查看变更状态
```bash
git status
git diff --stat
```

## Step 2: 查看具体变更内容
```bash
# 查看未暂存的变更
git diff

# 查看已暂存的变更
git diff --cached
```

## Step 3: 分析变更并生成提交信息
根据变更内容，生成符合 Conventional Commits 规范的提交信息：

格式：`<type>(<scope>): <description>`

类型（type）：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档变更
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具变更

## Step 4: 暂存并提交
```bash
# 暂存所有变更
git add .

# 或暂存特定文件
git add <file1> <file2>

# 提交（带 Co-Authored-By）
git commit -m "<type>(<scope>): <description>" -m "" -m "Co-Authored-By: AI Assistant <ai@assistant.local>"
```

## Step 5: 验证提交
```bash
git status
git log -1 --oneline
```
