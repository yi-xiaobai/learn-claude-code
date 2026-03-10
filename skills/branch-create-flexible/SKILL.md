---
name: branch-create-flexible
description: 灵活创建 Git 分支并用 IDE 打开。支持指定分支类型（feat/fix/hotfix）、基础分支和 IDE。触发场景：用户说"创建一个新功能分支"、"开一个 fix 分支"、"基于 dev 创建分支"、"用 VS Code 打开并创建分支"等。
tags: git, branch, ide, windsurf, vscode
args: <type> [base_branch] [ide]
---

# Branch Create Flexible - 灵活分支创建

用户想要创建新分支并用 IDE 打开项目时使用此技能。

## 输入格式

```
[type] [base_branch] [ide]
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

格式：`{type}/{描述}`

例如：
- `feat/add-user-login`
- `fix/navbar-overflow`
- `hotfix/payment-timeout`

如果用户提供了描述，使用用户描述；否则从现有分支名提取版本号 + 1

### Step 4: 先创建远程分支

```bash
# 基于基础分支创建远程分支
git push -u origin <base_branch>:<new_branch>
```

### Step 5: 拉取并切换到本地分支

```bash
# 拉取远程分支并切换
git fetch origin
git checkout -b <new_branch> origin/<new_branch>
```

### Step 6: 用 IDE 打开

**Windsurf:**
```bash
windsurf <project_path>
# 或
code --folder-uri <project_path>
```

**VS Code:**
```bash
code <project_path>
```

## 交互示例

**用户说："创建一个 fix 分支"**
```
type: fix
base_branch: dev (默认)
ide: windsurf (默认)
→ 基于 dev 创建远程分支 fix/xxx，切换本地分支，用 Windsurf 打开
```

**用户说："用 VS Code 打开项目，创建一个 feat 分支"**
```
type: feat
base_branch: dev (默认)
ide: vscode
→ 基于 dev 创建远程分支 feat/xxx，切换本地分支，用 VS Code 打开
```

**用户说："开一个 hotfix 分支，基于 master"**
```
type: hotfix
base_branch: master
ide: windsurf (默认)
→ 基于 master 创建远程分支 hotfix/xxx，切换本地分支，用 Windsurf 打开
```

## 错误处理

- 如果基础分支不存在，提示用户并列出可用分支
- 如果 IDE 命令不存在，提示用户安装
- 如果创建分支失败，显示错误信息

## 注意事项

- 保持分支名简洁清晰
- 基础分支默认为 dev
- IDE 默认为 Windsurf
