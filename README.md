# Learn Claude Code

学习 Claude Code 的代码示例和技能集合。

> **注意**：团队插件已迁移至独立仓库 [team-plugins](https://github.com/yi-xiaobai/team-plugins)

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
│   ├── github-trending-feishu/
│   ├── skill-lint/
│   ├── sync-skills/
│   ├── turtle-build/
│   ├── turtle-build-publish/
│   ├── turtle-publish/
│   └── work-log/
└── package.json
```

## 技能列表

### 效率工具

| 技能 | 描述 |
|------|------|
| `work-log` | 工作日志管理 - 任务记录、日期模板生成、PDF 自动导出 |
| `github-trending-feishu` | GitHub Trending 飞书推送 - 支持日/周/月热榜，定时推送 |
| `sync-skills` | 技能同步 - 将技能同步到多个目标目录 |
| `turtle-build` | Turtle 项目构建 - 自动化分支切换、构建、推送流程 |
| `turtle-publish` | Turtle NPM 发布 - 自动递增版本、私有仓库认证、发布推送 |
| `turtle-build-publish` | Turtle 构建发布 - 构建+版本更新+发布的一体化流程 |

### 代码质量

| 技能 | 描述 |
|------|------|
| `skill-lint` | 技能合规检查 - 扫描硬编码路径、敏感信息，检查 .env 引入 |

### 重点技能

**skill-lint** - 技能合规检查器
- 🔍 扫描硬编码路径（`/Users/xxx/`、`/home/xxx/`）
- 🔐 检测敏感信息泄露（Token、Key、数据库密码）
- 📦 检查 .env 文件是否被正确引入
- ✅ 支持 Python 脚本内部加载 .env 的智能检测

**work-log** - 智能工作日志
- 📅 自动生成工作日日期模板（周一前插入周分隔）
- ✏️ 任务管理、相对日期识别、特殊标记（请假、休假）
- 📄 AppleScript 自动导出 PDF（需 Typora + 辅助功能权限）

**github-trending-feishu** - GitHub 热榜推送
- 📊 支持日/周/月热榜（`--since daily|weekly|monthly`）
- 📅 定时推送：工作日 10:00 日热榜，每周一周热榜，每月 1 号月热榜
- 💬 飞书卡片消息，精美排版

**turtle-build** - Turtle 项目自动化
- 🔄 自动切换远端分支（检查分支存在性）
- 🏗️ 执行 yarn build 构建
- 📤 智能生成提交信息并推送

**turtle-publish** - Turtle NPM 发布
- 📦 自动递增 patch 版本号
- 🔐 私有仓库认证登录
- 🔄 失败自动重试（删除 ~/.nvmrc）
- 📤 发布后自动 git push

**turtle-build-publish** - Turtle 构建发布一体化
- 🔄 可选切换分支（用户提供分支名时）
- 🏗️ 构建 → 版本更新 → 发布 → 推送
- 📦 自动递增 patch 版本并发布到私有仓库

**sync-skills** - 技能同步工具
- 🔄 支持多目标路径同步
- 📋 可配置技能列表
- ✨ 自动同步到指定目录

## 开始使用

1. 安装依赖：
```bash
yarn install
```

2. 配置环境变量（复制 `.env.example` 为 `.env` 并填写 API Key）：
```bash
cp .env.example .env
```

### 技能配置

各技能需要单独配置环境变量，在对应技能目录下创建 `.env` 文件：

**work-log**
```bash
WORK_LOG_PATH=~/Documents/工作日志.md
```

**turtle-build**
```bash
TURTLE_PROJECT_PATH=~/path/to/your/turtle-project
```

**turtle-publish**
```bash
TURTLE_PROJECT_PATH=~/path/to/your/turtle-project
NPM_REGISTRY=https://registry.example.com
NPM_USERNAME=your_username
NPM_PASSWORD=your_password
NPM_EMAIL=your_email
```

**turtle-build-publish**
```bash
TURTLE_PROJECT_PATH=~/path/to/your/turtle-project
NPM_REGISTRY=https://registry.example.com
NPM_USERNAME=your_username
NPM_PASSWORD=your_password
NPM_EMAIL=your_email
```

**github-trending-feishu**
```bash
FEISHU_WEBHOOK=your_webhook_url
FEISHU_SECRET=your_secret  # 可选
```

**sync-skills**
```bash
SYNC_TARGET_PATHS=~/Documents/13_AI/learn-claude-code/skills:~/backups/skills
SYNC_SKILLS=github-trending-feishu:skill-lint:sync-skills:turtle-build:turtle-publish:turtle-build-publish:work-log
```

## 依赖

- `@anthropic-ai/sdk`: Anthropic Claude API SDK
- `dotenv`: 环境变量管理
