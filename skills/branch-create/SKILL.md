---
name: branch-create
description: 自动创建分支并打开 Windsurf IDE。新功能打开 master-web，bug/线上问题打开 mg-oncall。支持快速添加新项目。
tags: git, branch, windsurf, ide, gitlab
---

# 分支创建 Skill

自动创建 Git 分支（本地+远程）并打开对应的 Windsurf IDE 项目。

---

## 快速使用

### 方式1：直接执行脚本

```bash
# 创建新功能分支（自动选择匹配的项目）
/Users/luoyi/Documents/13_AI/learn-claude-code/skills/branch-create/create-branch.sh feat

# 创建新功能分支，指定项目
/Users/luoyi/Documents/13_AI/learn-claude-code/skills/branch-create/create-branch.sh feat master-web
/Users/luoyi/Documents/13_AI/learn-claude-code/skills/branch-create/create-branch.sh feat new-project

# 创建 bug 修复分支（打开 mg-oncall）
/Users/luoyi/Documents/13_AI/learn-claude-code/skills/branch-create/create-branch.sh fix

# 创建 bug 修复分支，指定项目
/Users/luoyi/Documents/13_AI/learn-claude-code/skills/branch-create/create-branch.sh fix mg-oncall

# 创建线上问题分支（同 fix）
/Users/luoyi/Documents/13_AI/learn-claude-code/skills/branch-create/create-branch.sh hotfix
```

### 方式2：自然语言（Claude 执行）

用户说：
- "帮我创建一个新功能分支"
- "创建 fix 分支"
- "开一个线上问题分支"

Claude 执行：
```bash
/Users/luoyi/Documents/13_AI/learn-claude-code/skills/branch-create/create-branch.sh <type>
```

---

## 项目映射规则

| 任务类型 | 分支命名 | 打开的项目 |
|---------|---------|-----------|
| feat (新功能) | `feat_canvas_v0`, `v1`... | master-web |
| fix (Bug修复) | `fix_canvas_v0`, `v1`... | mg-oncall |
| hotfix (线上问题) | `fix_canvas_v0`, `v1`... | mg-oncall |

---

## 添加新项目

编辑 `projects.conf` 文件，添加一行：

```bash
# 格式: 项目别名|项目路径|GitLab Project ID|分支前缀|任务类型
new-project|/path/to/project|123|feature|all
```

**任务类型说明**：
- `feat` - 只处理新功能
- `fix` - 只处理 bug/hotfix
- `all` - 两种都处理

**示例**：添加 admin-web 项目
```bash
admin-web|/Users/luoyi/Documents/1_project/admin-web|456|admin|all
```

---

## 版本号计算逻辑

1. 扫描本地分支：`git branch --list "feat_canvas_v*"`
2. 扫描远程分支：`git branch -r --list "origin/feat_canvas_v*"`
3. 提取所有版本号，找到最大值
4. 新版本 = 最大值 + 1

**示例**：
- 现有分支：`feat_canvas_v0`, `feat_canvas_v1`, `feat_canvas_v3`
- 新分支：`feat_canvas_v4`

---

## 执行流程

```
1. 检查参数 (feat/fix/hotfix)
        ↓
2. 读取 projects.conf，确定项目路径和分支前缀
        ↓
3. 扫描本地+远程分支，计算新版本号
        ↓
4. 暂存本地未提交改动 (git stash)
        ↓
5. GitLab API 创建远程分支
        ↓
6. git fetch + checkout 本地分支
        ↓
7. 还原暂存改动
        ↓
8. 打开 Windsurf IDE
```

---

## 配置文件说明

### projects.conf 格式

```
项目别名|项目路径|GitLab Project ID|分支前缀|任务类型
```

### 当前配置

| 项目 | 路径 | Project ID | 前缀 | 类型 |
|-----|------|-----------|------|-----|
| master-web | /Users/luoyi/.../master-web | 122 | canvas | feat |
| mg-oncall | /Users/luoyi/.../mg-oncall | 122 | canvas | fix |

---

## 快速命令示例

| 用户说 | 执行命令 |
|-------|---------|
| "创建新功能分支" | `./create-branch.sh feat` |
| "创建新功能分支到 master-web" | `./create-branch.sh feat master-web` |
| "开个 fix 分支" | `./create-branch.sh fix` |
| "开个 fix 分支到 mg-oncall" | `./create-branch.sh fix mg-oncall` |
| "处理线上问题" | `./create-branch.sh hotfix` |
| "新建 feature 分支" | `./create-branch.sh feat` |

---

## 可选：配置全局别名

在 `~/.zshrc` 或 `~/.bashrc` 中添加：

```bash
alias newbranch='/Users/luoyi/Documents/13_AI/learn-claude-code/skills/branch-create/create-branch.sh'
alias nb='/Users/luoyi/Documents/13_AI/learn-claude-code/skills/branch-create/create-branch.sh'
```

使用：
```bash
nb feat
nb fix
```
