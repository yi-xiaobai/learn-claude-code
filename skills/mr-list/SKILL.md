---
name: mr-list
description: 获取当前项目的 GitLab Merge Request 列表。当用户说"查看MR"、"MR列表"、"gitlab MR"、"看下MR状态"、"列出MR"、"show MRs"、"有什么MR"时使用此技能。显示每个 MR 的标题、编号、作者、状态、创建时间和 Pipeline 状态，以表格形式展示。默认只显示当前用户的 MR，使用 --all 参数显示所有 MR。
---

# GitLab MR 列表查看

快速查看当前项目的 Open Merge Request，包含 Pipeline 状态等关键信息。

## 配置

在 `~/.claude/skills/mr-list/.env` 中配置：

```bash
GITLAB_HOST=gitlab.company.com
GITLAB_TOKEN=glpat-xxxxxxxxxx
```

## 参数

| 参数 | 说明 |
|------|------|
| `--all` | 显示所有 MR（默认只显示当前用户的） |

## 执行

```bash
python3 ~/.claude/skills/mr-list/scripts/mr_list.py "$@"
```

## 输出示例

```
📋 **group/project** - Open MR 列表（作者: zhangsan）(3 个)

| # | 标题 | 作者 | 源分支 → 目标分支 | 更新时间 | 状态 |
|:---:|------|------|------------------|----------|----------|
| [#42](url) | feat: 添加用户登录功能 | zhangsan | `feat/login` → `dev` | 2026-03-12 | ✅ success |
| [#41](url) | fix: 修复订单金额计算 | lisi | `fix/order-amount` → `dev` | 2026-03-11 | ❌ failed |

💡 查看详情: https://your-gitlab.company.com/group/project/merge_requests
```

## 触发短语

| 用户说 | 行为 |
|--------|------|
| "查看MR" | 显示当前用户的 open MR 列表 |
| "MR列表" | 同上 |
| "看下MR状态" | 同上 |
| "查看所有MR" | 显示所有 open MR（包含其他用户） |
| "MR列表 --all" | 同上 |

## 错误处理

- **配置缺失**: 提示配置 Token
- **权限问题**: 提示检查 Token 权限
- **无 MR**: 显示友好提示
