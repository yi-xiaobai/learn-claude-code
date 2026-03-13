---
name: sync-skills
description: 同步技能到指定目录。当用户说"同步技能"、"sync skills"、"推送技能"时使用此技能。根据 .env 配置同步指定的技能目录。
支持多个目标路径。
使用方式：直接说"同步技能"即可.
 注意: 本技能自身也会被同步. 同步完成后记得手动执行此技能来更新目标目录中的副本.
---

# 同步技能

将指定技能同步到多个目标目录。

## 配置

编辑 `~/.claude/skills/sync-skills/.env`：

```bash
# 同步目标路径（多个路径用冒号分隔)
SYNC_TARGET_PATHS=~/Documents/13_AI/learn-claude-code/skills:~/backups/skills

# 需要同步的技能列表(冒号分隔)
SYNC_SKILLS=branch-create-flexible:code-check:git-sync-smart:mr-list:create-mr:skill-lint:sync-skills:turtle-build:work-log
```

## 执行

```bash
~/.claude/skills/sync-skills/scripts/sync-skills.sh
```

## 触发短语

| 用户说 | 行为 |
|--------|------|
| "同步技能" | 执行同步 |
| "sync skills" | 执行同步 |
| "推送技能" | 执行同步 |

## 输出示例

```
🔄 同步技能到 ~/Documents/13_AI/learn-claude-code/skills

✅ branch-create-flexible
✅ code-check
✅ git-sync-smart
✅ mr-list
✅ create-mr
✅ skill-lint
✅ sync-skills
✅ turtle-build
✅ work-log

✨ 同步完成: 2026-03-13 11:43:30
```

## 注意

- 技能列表使用冒号分隔
- 目标路径支持多个（冒号分隔）
- 配置文件为 `.env` 格式，会被 lint 检查忽略
