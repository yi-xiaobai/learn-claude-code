# Learn Claude Code

学习 Claude Code 的代码示例和技能集合。

## 项目结构

```
.
├── agents/          # Claude Agent 示例代码
│   ├── s01_agent_loop.js
│   ├── s02_tool_use.js
│   ├── s03_todo_write.js
│   ├── s04_subagent.js
│   ├── s05_skill_loading.js
│   ├── s06_context_compact.js
│   ├── s07_task_system.js
│   ├── s08_background_tasks.js
│   └── s09_agent_teams.js
├── docs/            # 文档
│   └── agent-tutorial.md
├── skills/          # Claude Code 技能
│   ├── branch-create/
│   ├── code-review/
│   ├── git-sync-smart/
│   └── work-log/
└── package.json
```

## 技能列表

| 技能 | 描述 |
|------|------|
| `git-sync-smart` | 智能同步 - 智能处理冲突 |
| `branch-create` | 自动创建 Git 分支并打开 Windsurf IDE |
| `code-review` | 代码审查 - 检查 bug 和改进点 |
| `work-log` | 工作日志管理 |

## 开始使用

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量（复制 `.env.example` 为 `.env` 并填写 API Key）：
```bash
cp .env.example .env
```

### branch-create 技能配置

1. 复制 `skills/branch-create/.env.example` 为 `.env`，填入 GitLab Token：
```
GITLAB_TOKEN=your_token
GITLAB_HOST=gitlab.com
BASE_BRANCH=master
```

2. 在 `skills/branch-create/` 目录下创建 `projects.conf`，添加项目配置：
```
# 格式: 项目别名|项目路径|GitLab Project ID|分支前缀[,fix前缀]|任务类型
# 示例:
my-project|/Users/you/Documents/projects/my-project|123|feature|feat
```

GitLab Token 获取：GitLab -> Preferences -> Access Tokens -> 创建并勾选 `api` 权限。

## 依赖

- `@anthropic-ai/sdk`: Anthropic Claude API SDK
- `dotenv`: 环境变量管理
