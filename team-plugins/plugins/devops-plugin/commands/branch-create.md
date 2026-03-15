---
description: 灵活创建 Git 分支并用 IDE 打开。支持指定分支类型（feat/fix/hotfix）、基础分支和 IDE。
disable-model-invocation: true
---

# Branch Create - 灵活分支创建

用户想要创建新分支并用 IDE 打开项目时使用此命令。

## 输入格式

```
/devops:branch-create [type] [base_branch] [ide]
```

**参数说明：**
- `type`: 分支类型 - `feat`(新功能) / `fix`(Bug修复) / `hotfix`(线上紧急修复)
- `base_branch`: 可选，基础分支 - 如 `dev`、`master`、`main` 等，默认 `dev`
- `ide`: 可选，IDE 类型 - `windsurf` / `vscode`，默认 `windsurf`

## 执行流程

### Step 1: 解析参数

根据用户输入确定：
- 分支类型（feat/fix/hotfix）
- 基础分支（默认 dev）
- IDE（默认 windsurf）

### Step 2: 确定项目路径

1. 如果用户在当前项目目录下，直接使用当前目录
2. 如果用户指定了项目路径，使用指定路径
3. 如果不确定，询问用户

### Step 3: 生成分支名

格式：`{type}-{优化的英文描述}-v{版本号}`

**版本号规则：**
1. 获取本地所有该类型的分支（如 `feat-*`）
2. 提取其中最大的版本号，没有则从 v0 开始
3. 新分支使用 `v{最大版本号 + 1}`

**中文描述转英文规则：**
1. 将中文描述翻译为简洁的英文短语
2. 使用 kebab-case（短横线分隔）
3. 保持简短（建议 2-4 个单词）

### Step 4: 先拉取远程最新状态

```bash
git fetch origin
```

### Step 5: 创建远程分支

```bash
git push origin origin/<base_branch>:refs/heads/<new_branch>
```

### Step 6: 切换到本地分支

```bash
git fetch origin
git checkout -b <new_branch> origin/<new_branch>
```

### Step 7: 用 IDE 打开

**Windsurf:**
```bash
windsurf <project_path>
```

**VS Code:**
```bash
code <project_path>
```

## 交互示例

**用户说："/devops:branch-create fix"**
```
type: fix
base_branch: dev (默认)
ide: windsurf (默认)
→ 基于 dev 创建远程分支 fix/xxx，切换本地分支，用 Windsurf 打开
```

## 错误处理

- 如果基础分支不存在，提示用户并列出可用分支
- 如果 IDE 命令不存在，提示用户安装
- 如果创建分支失败，显示错误信息
