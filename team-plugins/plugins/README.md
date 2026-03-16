# Team Plugins

扁平式插件目录，每个插件独立管理。

## 插件列表

| 插件 | 命令 | 说明 |
|------|------|------|
| **branch-commands** | `/branch-create`, `/branch-switch`, `/branch-delete` | Git 分支工作流 |
| **commit-commands** | `/commit`, `/commit-push`, `/commit-push-mr` | Git 提交工作流 |
| **mr-list** | `/mr-list` | 查看 GitLab MR 列表 |
| **work-log** | `/log`, `/generate-week` | 工作日志管理 |
| **turtle-build** | `/build` | Turtle 项目构建 |
| **github-trending** | `/trending` | GitHub 热榜推送 |

## 目录结构

```
plugins/
├── branch-commands/
│   ├── .claude-plugin/plugin.json
│   ├── commands/
│   │   ├── branch-create.md
│   │   ├── branch-switch.md
│   │   └── branch-delete.md
│   └── README.md
├── commit-commands/
│   ├── .claude-plugin/plugin.json
│   ├── commands/
│   │   ├── commit.md
│   │   ├── commit-push.md
│   │   └── commit-push-mr.md
│   └── README.md
├── mr-list/
│   ├── .claude-plugin/plugin.json
│   ├── commands/mr-list.md
│   └── README.md
├── work-log/
│   ├── .claude-plugin/plugin.json
│   ├── commands/
│   │   ├── log.md
│   │   └── generate-week.md
│   └── README.md
├── turtle-build/
│   ├── .claude-plugin/plugin.json
│   ├── commands/build.md
│   └── README.md
└── github-trending/
    ├── .claude-plugin/plugin.json
    ├── commands/trending.md
    └── README.md
```

## 命令文件格式

参考 [Anthropic 官方插件](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/commit-commands)：

```markdown
---
allowed-tools: Bash(git add:*), Bash(git commit:*)
description: Short description
---

## Context

- Current status: !`git status`

## Your task

Instructions for Claude...
```

**关键特性**：
- `allowed-tools`: 限制可用工具
- `!` 语法: 动态获取上下文
- 简洁指令: 详细文档放 README.md
