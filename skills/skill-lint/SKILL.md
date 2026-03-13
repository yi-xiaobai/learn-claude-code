---
name: skill-lint
description: 检查 Claude Code 技能的合规性。当用户说"检查技能"、"技能合规"、"skill lint"、"检查skills"时使用此技能。扫描 SKILL.md 文件中的硬编码路径、敏感信息泄露风险，并检查 .env 文件是否被正确忽略。
---

# 技能合规检查器

扫描技能目录，检查常见问题并生成报告。

## 检查项

| 检查项 | 问题 | 建议 |
|--------|------|------|
| 硬编码用户路径 | `/Users/某用户/`、`/home/某用户/` | 用 `~` 或 `$HOME` 替代 |
| 硬编码绝对路径 | 其他绝对路径 `/...` | 用相对路径或环境变量替代 |
| 公司/项目信息 | 域名、公司名等 | 用占位符替代 |
| .env 未忽略 | `.env` 文件未被 git 忽略 | 添加到 .gitignore |

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

📄 create-mr/SKILL.md

  ❌ 第 38 行: 硬编码用户路径
     source /Users/某用户/.claude/skills/create-mr/.env
     💡 建议: source ~/.claude/skills/create-mr/.env

  ⚠️  第 24 行: 包含域名
     GITLAB_HOST=gitlab.company.com
     💡 建议: 使用占位符 your-gitlab.company.com

📄 work-log/SKILL.md

  ✅ 无问题

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 汇总: 2 个问题 (1 错误, 1 警告)
```

## 错误级别

| 级别 | 图标 | 说明 |
|------|------|------|
| 错误 | ❌ | 必须修复（如硬编码路径、敏感信息） |
| 警告 | ⚠️ | 建议修复（如域名、公司名） |
| 通过 | ✅ | 无问题 |
