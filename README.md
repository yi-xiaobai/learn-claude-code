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
│   ├── create-mr/
│   ├── git-sync-smart/
│   ├── github-trending-feishu/
│   ├── mr-list/
│   ├── skill-lint/
│   └── work-log/
├── skills-testing/  # 技能测试用例
│   ├── git-commit/
│   ├── git-sync-smart/
│   └── work-log/
└── package.json
```

## 技能列表

### Git 工作流

| 技能 | 描述 | 测试用例 |
|------|------|---------|
| `branch-create-flexible` | 灵活创建分支 - 支持自定义基础分支和 IDE，版本号管理 | - |
| `git-sync-smart` | 智能同步 - 自动处理冲突，备份分支 | 3 |
| `mr-list` | GitLab MR 列表查看 - 显示 MR 的标题、作者、Pipeline 状态 | - |
| `create-mr` | GitLab MR 自动创建 - 基于当前分支自动创建 Merge Request | - |

### 代码质量

| 技能 | 描述 | 测试用例 |
|------|------|---------|
| `code-check` | 提交前自检 - 运行静态分析并给出改进建议 | - |
| `skill-lint` | 技能合规检查 - 扫描硬编码路径、敏感信息，检查 .env 引入 | - |

### 效率工具

| 技能 | 描述 | 测试用例 |
|------|------|---------|
| `work-log` | 工作日志管理 - 任务记录、日期模板、PDF 导出 | 6 |
| `github-trending-feishu` | GitHub Trending 飞书推送 - 支持日/周/月热榜 | - |
| `sync-skills` | 技能同步 - 将技能同步到多个目标目录 | - |
| `turtle-build` | Turtle 项目构建 - 自动化分支切换、构建、推送流程 | - |

**总计：9 个测试用例**

### 重点技能

**skill-lint** - 技能合规检查器
- 🔍 扫描硬编码路径（`/Users/xxx/`、`/home/xxx/`）
- 🔐 检测敏感信息泄露（Token、Key）
- 📦 检查 .env 文件是否被正确引入
- ✅ 支持 Python 脚本内部加载 .env 的智能检测

**work-log** - 智能工作日志
- 📅 自动生成下周日期（周一前插入周分隔）
- ✏️ 任务管理、相对日期、特殊标记
- 📄 AppleScript 自动导出 PDF

**git-sync-smart** - 安全推送
- 🔄 智能冲突处理：自动 rebase + 备份分支
- 🛡️ 冲突时展示 diff，用户选择解决方式
- ↩️ 支持回滚到备份状态

**github-trending-feishu** - GitHub 热榜推送
- 📊 支持日/周/月热榜（`--since daily|weekly|monthly`）
- 📅 定时推送：工作日 10:00 日热榜，每周一 10:00 周热榜，每月 1 号 10:00 月热榜
- 💬 飞书卡片消息，精美排版

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
