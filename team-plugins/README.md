# Team Claude Code Plugins

团队 Claude Code 插件集合，通过 Plugin Marketplace 统一分发和管理。

## Overview

本仓库提供团队统一的 Claude Code 插件，解决以下问题：

- **版本统一**: 所有团队成员使用相同版本，通过 Git tag 管理
- **统一分发**: 通过 Marketplace 一键安装，新人 5 分钟完成配置
- **可治理**: 所有变更需经过 MR 审核，支持 `strictKnownMarketplaces` 限制来源
- **标准化**: 统一的目录结构、配置方式和文档规范

## 插件列表

| 插件 | 命令 | 说明 |
|------|------|------|
| **branch-create** | `/branch-create` | 创建 Git 分支，自动版本号 |
| **commit-commands** | `/commit`, `/commit-push`, `/commit-push-mr` | Git 提交工作流 |
| **mr-list** | `/mr-list` | 查看 GitLab MR 列表 |
| **work-log** | `/log`, `/generate-week` | 工作日志管理 |
| **turtle-build** | `/build` | Turtle 项目构建 |
| **github-trending** | `/trending` | GitHub 热榜推送到飞书 |

## 快速开始

### 1. 添加 Marketplace

```bash
# 本地测试
/plugin marketplace add ./team-plugins

# 或从 Git 仓库（推送后）
/plugin marketplace add https://gitlab.yourcompany.com/team/claude-plugins.git
```

### 2. 安装插件

```bash
# 安装单个插件
/plugin install branch-create@team-plugins
/plugin install commit-commands@team-plugins
/plugin install mr-list@team-plugins
/plugin install work-log@team-plugins

# 或安装全部
/plugin install branch-create commit-commands mr-list work-log@team-plugins
```

### 3. 使用

```bash
# Git 工作流
/branch-create feat              # 创建功能分支
/commit                          # 提交
/commit-push                     # 提交并推送
/commit-push-mr                  # 提交、推送并创建 MR
/commit-push-mr master           # 提交、推送并创建 MR 到 master

# 查看 MR
/mr-list                         # 查看 MR 列表
/mr-list --all                   # 查看所有 MR

# 效率工具
/log                             # 记录工作日志
/generate-week                   # 生成下周日期模板
/trending                        # GitHub 热榜

# 客户端
/build feature/xxx               # Turtle 构建
```

## 目录结构

```
team-plugins/
├── .claude-plugin/
│   └── marketplace.json
├── plugins/
│   ├── branch-create/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── commands/branch-create.md
│   │   └── README.md
│   ├── git-sync/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── commands/sync.md
│   │   └── README.md
│   ├── mr-commands/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── commands/
│   │   │   ├── mr-create.md
│   │   │   └── mr-list.md
│   │   └── README.md
│   ├── code-review/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── commands/review.md
│   │   └── README.md
│   ├── work-log/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── commands/
│   │   │   ├── log.md
│   │   │   └── generate-week.md
│   │   └── README.md
│   ├── turtle-build/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── commands/build.md
│   │   └── README.md
│   └── github-trending/
│       ├── .claude-plugin/plugin.json
│       ├── commands/trending.md
│       └── README.md
└── README.md
```

> 参考 [Anthropic 官方插件结构](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/commit-commands)

## 团队配置（可选）

### 预装 Marketplace

在项目 `.claude/settings.json` 中配置：

```json
{
  "extraKnownMarketplaces": {
    "team-plugins": {
      "source": {
        "source": "github",
        "repo": "your-org/claude-plugins"
      }
    }
  }
}
```

### 预启用插件

```json
{
  "enabledPlugins": {
    "devops-plugin@team-plugins": true,
    "common-plugin@team-plugins": true
  }
}
```

### 限制只能使用团队 Marketplace

```json
{
  "strictKnownMarketplaces": [
    {
      "source": "github",
      "repo": "your-org/claude-plugins"
    }
  ]
}
```

## 配置要求

在 `~/.config/git-agent/.env` 中配置：

```bash
# GitLab 配置（devops-plugin 需要）
GITLAB_TOKEN=glpat-xxxxxxxxxx
GITLAB_HOST=gitlab.company.com

# 工作日志路径（common-plugin 需要）
WORK_LOG_PATH=~/Documents/工作日志.md

# 飞书 Webhook（common-plugin 需要）
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx

# Turtle 项目路径（client-plugin 需要）
TURTLE_PROJECT_PATH=~/path/to/turtle-project
```

## 贡献指南

1. 创建功能分支
2. 添加/修改插件
3. 更新插件的 README.md
4. 提交 MR 审核
5. 合并后打 tag 发布

## 版本管理

使用 Git tag 管理版本：

```bash
# 发布新版本
git tag v1.0.0
git push origin v1.0.0

# 团队成员更新
/plugin update devops-plugin@team-plugins
```

用户可以指定版本安装：

```bash
/plugin marketplace add your-org/claude-plugins@v1.0.0
```

## Troubleshooting

### 插件安装失败

- 检查 Marketplace 是否已添加
- 检查插件名称是否正确

### 命令执行失败

- 检查 `.env` 配置是否完整
- 查看各插件的 README.md 中的 Troubleshooting 部分

### 版本不一致

- 执行 `/plugin update <plugin>@team-plugins` 更新到最新版本
