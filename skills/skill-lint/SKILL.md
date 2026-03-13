---
name: skill-lint
description: 检查 Claude Code 技能的合规性。当用户说"检查技能"、"技能合规"、"skill lint"、"检查skills"时使用此技能。扫描 SKILL.md 文件中的硬编码路径、敏感信息泄露风险，并检查 .env 文件是否被正确忽略。
---

# 技能合规检查器

扫描技能目录，检查常见问题并生成报告。

## 检查项

### ❌ 错误级别（必须修复）

| 检查项 | 匹配模式 | 说明 |
|--------|----------|------|
| 硬编码用户路径 | `/Users/xxx/`、`/home/xxx/` | 泄露本地环境信息 |
| API Key 泄露 | `sk-xxx`、`ghp_xxx`、`glpat-xxx` 等 | 检测 OpenAI/GitHub/GitLab 等平台密钥 |
| 连接串含密码 | 数据库连接串含 `user:pwd@` 格式 | 数据库连接字符串包含明文密码 |
| 敏感信息硬编码 | `token=xxx`、`password=xxx` | 变量赋值中包含敏感值 |
| .env 未被 git 忽略 | .gitignore 缺少 `.env` 规则 | 可能导致敏感信息泄露到版本库 |

**注意：** 表格中的 `xxx` 为占位符，实际检测时会匹配真实值。

**支持的 API Key 模式：**
- OpenAI: `sk-...`
- Anthropic: `sk-ant-...`
- GitHub PAT: `ghp_...`、`gho_...`
- GitLab PAT: `glpat-...`
- Slack: `xoxb-...`、`xoxp-...`
- 飞书: `cli_...`
- AWS: `AKIA...`

**支持的连接字符串协议：**
- MySQL、PostgreSQL、MongoDB、Redis、AMQP

### ⚠️ 警告级别（建议修复）

| 检查项 | 说明 |
|--------|------|
| 公司域名 | 如 `lanhuapp`、`feishu` 等内部域名 |
| 硬编码 IP | 如 `192.168.x.x` 格式的内网地址 |

### 🔐 配置检查

| 检查项 | 级别 | 说明 |
|--------|------|------|
| .env 未引入 | ⚠️ | 存在 `.env` 但 SKILL.md 中未引用 |
| .env 未被 git 忽略 | ❌ | .gitignore 缺少 `.env` 规则，**强烈禁止** |

## 执行

```bash
python3 ~/.claude/skills/skill-lint/scripts/lint.py "$@"
```

### 参数

| 参数 | 说明 |
|------|------|
| `--dir <path>` | 指定检查目录（默认 `~/.claude/skills/`） |
| `--fix` | 自动修复部分问题（输出修复建议） |

## 输出示例

```
🔍 技能合规检查
目录: ~/.claude/skills/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 openai-tool/SKILL.md

  ❌ 第 15 行: 疑似 API Key 泄露
     OPENAI_API_KEY=sk-proj-xxxx...
     💡 使用环境变量存储 API Key，切勿硬编码

📄 db-sync/SKILL.md

  ❌ 第 22 行: 连接字符串包含密码
     DATABASE_URL=postgres://admin:xxxxx@db.example.com
     💡 使用环境变量或配置文件存储密码，不要硬编码在连接串中

📄 create-mr/SKILL.md

  ❌ 第 38 行: 硬编码用户路径
     source /Users/yourname/.claude/skills/create-mr/.env
     💡 使用 ~ 或 $HOME 替代

  ⚠️  第 24 行: 可能的公司信息
     GITLAB_HOST=gitlab.example.com
     💡 使用占位符替代，如 your-company.com

📄 work-log/SKILL.md

  ✅ 无问题

🔐 安全检查
  ❌ .gitignore 未包含 .env 规则 - 可能导致敏感信息泄露！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 汇总: 4 个问题 (3 错误, 1 警告)
```

## 错误级别

| 级别 | 图标 | 说明 |
|------|------|------|
| 错误 | ❌ | 必须修复（如硬编码路径、敏感信息泄露、API Key） |
| 警告 | ⚠️ | 建议修复（如域名、公司名、IP 地址） |
| 通过 | ✅ | 无问题 |
