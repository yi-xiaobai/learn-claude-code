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
│   ├── branch-create-flexible/
│   ├── code-check/
│   ├── git-sync-smart/
│   ├── github-trending-feishu/
│   └── work-log/
├── skills-testing/  # 技能测试用例
│   ├── git-commit/
│   ├── git-sync-smart/
│   └── work-log/
└── package.json
```

## 技能列表

| 技能 | 描述 | 测试用例 |
|------|------|---------|
| `github-trending-feishu` | GitHub Trending 飞书推送 - 自动获取热榜并推送到飞书群 | - |
| `branch-create-flexible` | 灵活创建分支 - 支持自定义基础分支和 IDE，版本号管理 | - |
| `git-sync-smart` | 智能同步 - 自动处理冲突 | 3 |
| `code-check` | 提交前自检 - 运行静态分析并给出改进建议 | - |
| `work-log` | 工作日志管理 | 6 |

**总计：9 个测试用例** (不含 code-check, branch-create-flexible)

### 重点技能

**work-log** - 智能工作日志
- 📅 自动生成下周日期（周一前插入周分隔）
- ✏️ 任务管理、相对日期、特殊标记
- 📄 AppleScript 自动导出 PDF

**git-sync-smart** - 安全推送
- 🔄 智能冲突处理：自动 rebase + 备份分支
- 🛡️ 冲突时展示 diff，用户选择解决方式
- ↩️ 支持回滚到备份状态

## 开始使用

1. 安装依赖：
```bash
yarn install
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

## 测试

查看技能测试用例：

```bash
# 查看某个技能的测试用例
cat skills-testing/work-log/evals.json | jq

# 统计所有测试用例
find skills-testing -name "evals.json" -exec grep -c '"id"' {} \;
```

**注意事项**：
- `work-log`: 会修改工作日志文件
- `branch-create-flexible`: 需要 Git 仓库访问权限
- `work-log PDF 导出`: 需要辅助功能权限

## 依赖

- `@anthropic-ai/sdk`: Anthropic Claude API SDK
- `dotenv`: 环境变量管理
