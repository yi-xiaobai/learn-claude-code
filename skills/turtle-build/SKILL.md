---
name: turtle-build
description: 为 turtle 项目执行构建和推送。触发词: "构建turtle"、"turtle分支"、"在turtle项目上工作"。使用时提供分支名称。
version: 0.1.0
---

# Turtle 构建

切换分支 → 构建 → 推送的自动化流程。

**Key concepts:**
- 分支必须存在于远端
- 使用 yarn build
- 根据构建产物变化生成提交信息
- 错误即停

## 配置

`~/.claude/skills/turtle-build/.env`:
```
TURTLE_PROJECT_PATH=~/path/to/project
```

## Workflow

用户输入: `$ARGUMENTS` = 分支名称

```bash
# 1. 进入项目并获取最新
source ~/.claude/skills/turtle-build/.env && cd $TURTLE_PROJECT_PATH && git fetch

# 2. 检查分支是否存在 (不存在则停止)
git branch -r | grep "$ARGUMENTS"

# 3. 切换分支
git checkout $ARGUMENTS

# 4. 构建
yarn build

# 5. 提交推送 (根据变化生成描述)
git add . && git commit -m "chore(build): update dist bundle" && git push
```

## 提交信息模式

- `dist/` 变化 → `chore(build): update dist bundle`
- 多个 `.js/.css` → `chore(build): update compiled assets`
- 特定模块 → `chore(build): update <module-name> bundle`

## Troubleshooting

- **分支不存在**: `错误：远端分支 <name> 不存在`
- **切换失败**: 检查未提交的更改
- **构建失败**: 展示错误,停止执行
