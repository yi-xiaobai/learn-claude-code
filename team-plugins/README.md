# Team Claude Code Plugins

团队 Claude Code 插件集合，通过 Plugin Marketplace 统一分发和管理。

## 插件列表

| 插件 | 说明 | Commands | Skills |
|------|------|----------|--------|
| **devops-plugin** | DevOps 工具集 | branch-create, git-sync, mr-create | code-check, mr-list |
| **common-plugin** | 通用效率工具 | - | work-log, github-trending |
| **client-plugin** | 客户端构建工具 | turtle-build | - |

> **Commands vs Skills**:
> - **Commands**: 用户手动触发，简单指令（`disable-model-invocation: true`）
> - **Skills**: Claude 可自动调用，或需要脚本支持的复杂工作流

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
# 安装 DevOps 插件
/plugin install devops-plugin@team-plugins

# 安装通用插件
/plugin install common-plugin@team-plugins

# 安装客户端插件
/plugin install client-plugin@team-plugins
```

### 3. 使用

```bash
# DevOps 插件 - Commands（用户手动触发）
/devops:branch-create feat           # 创建功能分支
/devops:git-sync                     # 智能同步
/devops:mr-create                    # 创建 MR

# DevOps 插件 - Skills（Claude 可自动调用）
/devops:code-check                   # 代码检查
/devops:mr-list                      # 查看 MR 列表

# 通用插件 - Skills
/common:work-log                     # 工作日志
/common:github-trending              # GitHub 热榜

# 客户端插件 - Commands
/client:turtle-build feature/xxx     # Turtle 构建
```

## 目录结构

```
team-plugins/
├── .claude-plugin/
│   └── marketplace.json              # Marketplace 清单
├── plugins/
│   ├── devops-plugin/                # DevOps 插件
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/                 # 用户手动触发
│   │   │   ├── branch-create.md
│   │   │   ├── git-sync.md
│   │   │   └── mr-create.md
│   │   └── skills/                   # Claude 可自动调用
│   │       ├── code-check/
│   │       │   └── SKILL.md
│   │       └── mr-list/
│   │           └── SKILL.md
│   ├── common-plugin/                # 通用插件
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   └── skills/
│   │       ├── work-log/
│   │       │   └── SKILL.md
│   │       └── github-trending/
│   │           └── SKILL.md
│   └── client-plugin/                # 客户端插件
│       ├── .claude-plugin/
│       │   └── plugin.json
│       └── commands/
│           └── turtle-build.md
└── README.md
```

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

## 贡献指南

1. Fork 本仓库
2. 创建功能分支
3. 添加/修改 Skills
4. 提交 MR 审核
5. 合并后自动生效

## 版本管理

使用 Git tag 管理版本：

```bash
git tag v1.0.0
git push origin v1.0.0
```

用户可以指定版本安装：

```bash
/plugin marketplace add your-org/claude-plugins@v1.0.0
```
