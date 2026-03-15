---
description: 为 turtle 项目执行构建和推送工作流。切换分支、构建并推送。
disable-model-invocation: true
---

# Turtle 项目构建工作流

自动化 turtle 项目的分支切换、构建和推送流程。

## 使用方式

```
/client:turtle-build <branch_name>
```

## 工作流程

1. **切换分支**: 从远端拉取最新代码并切换到指定分支
2. **构建项目**: 执行 `yarn build`
3. **提交推送**: 将构建产物提交并推送到远端

## 配置

在技能目录下创建 `.env` 文件：

```bash
TURTLE_PROJECT_PATH=~/path/to/your/turtle-project
```

## 执行步骤

### 步骤 1: 切换分支

```bash
source ~/.claude/skills/turtle-build/.env && cd $TURTLE_PROJECT_PATH && git fetch
git branch -r | grep "<分支名>"
git checkout <分支名>
```

**重要**: 如果远端分支不存在，**立即停止**并告知用户

### 步骤 2: 构建项目

```bash
source ~/.claude/skills/turtle-build/.env && cd $TURTLE_PROJECT_PATH && yarn build
```

**错误处理**: 如果构建失败，停止并向用户展示错误信息

### 步骤 3: 提交并推送

```bash
source ~/.claude/skills/turtle-build/.env && cd $TURTLE_PROJECT_PATH && git status
git diff --stat
git add . && git commit -m "<根据变化生成的描述>" && git push
```

**提交信息示例**:
- `chore(build): update dist bundle for user-auth feature`
- `chore(build): recompile assets after dependency update`

## 使用示例

```
/client:turtle-build feature/new-ui
→ checkout feature/new-ui -> yarn build -> commit & push
```

## 重要提示

1. **按顺序执行**: 必须严格按照步骤 1 → 2 → 3 的顺序执行
2. **远端分支必须存在**: 切换分支前必须确认远端分支存在
3. **错误即停**: 任何步骤失败都要停止并提示用户
4. **智能提交信息**: 根据构建产物的变化生成描述性的提交信息
