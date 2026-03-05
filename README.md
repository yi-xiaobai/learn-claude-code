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
│   ├── code-review/
│   ├── git-commit/
│   ├── git-push/
│   ├── git-sync/
│   ├── git-sync-smart/
│   ├── pdf/
│   └── work-log/
└── package.json
```

## 技能列表

| 技能 | 描述 |
|------|------|
| `git-commit` | 分析变更并生成提交信息 |
| `git-sync` | 一键同步 - add, commit, push |
| `git-sync-smart` | 智能同步 - 智能处理冲突 |
| `git-push` | 安全推送到远端 |
| `code-review` | 代码审查 - 检查 bug 和改进点 |
| `pdf` | PDF 处理技能 |
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

## 依赖

- `@anthropic-ai/sdk`: Anthropic Claude API SDK
- `dotenv`: 环境变量管理
