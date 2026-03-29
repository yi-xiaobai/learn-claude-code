# Learn Claude Code

Claude Code 代码示例和技能集合。

> 团队插件已迁移至 [team-plugins](https://github.com/yi-xiaobai/team-plugins)

## 技能

| 技能 | 描述 |
|------|------|
| `work-log` | 工作日志管理，支持任务记录、日期模板、PDF 导出 |
| `github-trending-feishu` | GitHub 热榜飞书推送，支持日/周/月榜定时推送 |
| `turtle-build` | Turtle 项目构建，分支切换 → 构建 → 推送 |
| `turtle-publish` | Turtle NPM 发布，版本递增 → 认证 → 发布 |
| `turtle-build-publish` | Turtle 构建发布一体化流程 |
| `sync-skills` | 技能多目录同步 |
| `skill-lint` | 技能合规检查，扫描硬编码路径和敏感信息 |

## 快速开始

```bash
yarn install
cp .env.example .env  # 配置 API Key
```

各技能在对应目录下创建 `.env` 配置环境变量。

## 项目结构

```
agents/     # Claude Agent 示例代码 (s01-s09)
docs/       # 文档
skills/     # Claude Code 技能
```
