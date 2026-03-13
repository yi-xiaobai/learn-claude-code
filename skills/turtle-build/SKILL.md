---
name: turtle-build
description: 为 turtle 项目执行构建和推送工作流。当用户提到"turtle"、"构建turtle"、"turtle分支"、"在turtle项目上工作"，或需要在turtle项目中切换分支、构建并推送时使用此技能。使用方式：提供分支名称即可。
---

# Turtle 项目构建工作流

这个技能用于自动化 turtle 项目的分支切换、构建和推送流程。

## 工作流程

1. **切换分支**: 从远端拉取最新代码并切换到指定分支（分支必须存在于远端）
2. **构建项目**: 执行构建命令
3. **提交推送**: 将构建产物提交并推送到远端

## 项目信息

- **项目路径**: `$TURTLE_PROJECT_PATH` 环境变量
- **包管理器**: yarn
- **构建命令**: `yarn build`

## 配置

在技能目录下创建 `.env` 文件：

```bash
TURTLE_PROJECT_PATH=~/path/to/your/turtle-project
```

## 执行步骤

### 步骤 1: 切换分支

1. **获取远端最新信息**

```bash
source ~/.claude/skills/turtle-build/.env && cd $TURTLE_PROJECT_PATH && git fetch
```

2. **检查远端分支是否存在**:

```bash
git branch -r | grep "<分支名>"
```

**重要**: 如果远端分支不存在，**立即停止**并告知用户：`错误：远端分支 <分支名> 不存在，请检查分支名称`

3. **切换到指定分支**:

```bash
git checkout <分支名>
```

**错误处理**:
- 如果有未提交的更改导致切换失败，停止并提示用户处理

### 步骤 2: 构建项目

执行 yarn build：

```bash
source ~/.claude/skills/turtle-build/.env && cd $TURTLE_PROJECT_PATH && yarn build
```

**错误处理**:
- 如果构建失败，停止并向用户展示错误信息
- 不要继续执行后续的提交和推送步骤

### 步骤 3: 提交并推送

构建成功后，根据构建产物的变化生成有意义的提交信息：

1. **查看变化**: 首先检查有哪些文件发生了变化

```bash
source ~/.claude/skills/turtle-build/.env && cd $TURTLE_PROJECT_PATH && git status
```

2. **分析变化**: 查看具体的变化统计

```bash
git diff --stat
```

3. **生成提交信息**: 根据变化的文件生成描述性提交信息

常见的构建产物模式：
- `dist/` 目录变化 → `chore(build): update dist bundle`
- 多个 `.js/.css` 文件 → `chore(build): update compiled assets`
- 特定模块变化 → `chore(build): update <module-name> bundle`
- 配置文件 + 构建 → `chore(build): rebuild after config changes`

提交并推送：

```bash
git add . && git commit -m "<根据变化生成的描述>" && git push
```

**示例提交信息**:
- `chore(build): update dist bundle for user-auth feature`
- `chore(build): recompile assets after dependency update`
- `chore(build): update production build for hotfix-456`

## 使用示例

**示例 1**: 切换到 feature 分支
```
用户: 帮我在 turtle 项目切换到 feature/new-ui 分支并构建
执行: checkout feature/new-ui -> yarn build -> commit & push
```

**示例 2**: 使用简短分支名
```
用户: turtle 项目用 hotfix-123 分支
执行: checkout hotfix-123 -> yarn build -> commit & push
```

## 重要提示

1. **按顺序执行**: 必须严格按照步骤 1 → 2 → 3 的顺序执行
2. **远端分支必须存在**: 切换分支前必须确认远端分支存在，不存在则立即停止并告知用户
3. **错误即停**: 任何步骤失败都要停止并提示用户，不要继续执行
4. **智能提交信息**: 根据构建产物的变化生成描述性的提交信息，不要只用 `chore: build`
5. **不需要打开 IDE**: 整个流程在命令行完成，无需打开 Windsurf 或其他 IDE
