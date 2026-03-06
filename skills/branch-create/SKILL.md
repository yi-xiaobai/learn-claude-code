---
name: branch-create
description: 自动创建 Git 分支并打开 Windsurf IDE。新功能打开 master-web，bug/线上问题打开 mg-oncall。
tags: git, branch, windsurf, ide, gitlab
args: <type> [project] [base_branch]
---

# 分支创建 Skill

用户说"创建一个新功能分支"、"开一个 fix 分支"时使用此 skill。

## 执行方式

```bash
/Users/luoyi/Documents/13_AI/learn-claude-code/skills/branch-create/scripts/create-branch.sh <type> [project] [base_branch]
```

**参数说明**：
- `type`: 分支类型 - `feat`(新功能) / `fix`(Bug修复) / `hotfix`(线上问题)
- `project`: 可选，项目别名 - `master-web` / `mg-oncall`
- `base_branch`: 可选，基础分支 - `master` / `dev` 等

## 项目映射

| 类型 | 分支命名 | 项目 |
|-----|---------|------|
| feat | `feat_canvas_v0` | master-web |
| fix/hotfix | `fix_oncall_v0` | mg-oncall |

## 示例

- 创建一个新功能分支 → `feat` + 自动选择项目
- 创建 fix 分支 → `fix` + 自动选择项目
- 基于 dev 创建 fix 分支 → `fix mg-oncall dev`

## 版本号

自动从现有分支名中提取最大版本号，新分支 = 最大版本 + 1

## 配置文件

编辑 `projects.conf` 添加新项目：
```
项目别名|项目路径|GitLab Project ID|分支前缀|任务类型(feat/fix/all)
```
