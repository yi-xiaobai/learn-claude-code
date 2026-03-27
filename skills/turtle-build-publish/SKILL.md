---
name: turtle-build-publish
description: turtle 项目构建并发布到 npm 私有仓库。触发词: "构建并发布turtle"、"turtle build publish"、"发布turtle项目"。
version: 0.1.0
---

# Turtle 构建发布

构建 → 版本更新 → 发布 → 推送的一体化流程。

**Key concepts:**
- 可选切换分支 (用户提供分支名时)
- 使用 yarn build
- 自动递增 patch 版本
- 失败自动重试 (删除 ~/.nvmrc)
- 发布后自动 git push

## 配置

`~/.claude/skills/turtle-build-publish/.env`:
```
TURTLE_PROJECT_PATH=~/path/to/project
NPM_REGISTRY=https://registry.example.com
NPM_USERNAME=
NPM_PASSWORD=
NPM_EMAIL=
```

## Workflow

```bash
# 1. 进入项目
source ~/.claude/skills/turtle-build-publish/.env && cd $TURTLE_PROJECT_PATH && git fetch

# 2. 如果用户指定分支,切换分支
git checkout $ARGUMENTS  # 可选

# 3. 构建
yarn build

# 4. 更新版本
npm version patch --no-git-tag-version

# 5. 配置并登录 npm
npm config set registry $NPM_REGISTRY && \
echo -e "$NPM_USERNAME\n$NPM_PASSWORD\n$NPM_EMAIL" | npm adduser --registry $NPM_REGISTRY

# 6. 发布 (失败时删除 ~/.nvmrc 重试)
npm publish || (rm -f ~/.nvmrc && npm publish)

# 7. 提交推送
git add . && git commit -m "chore(release): bump version and update dist" && git push
```

## Troubleshooting

- **分支不存在**: `错误：远端分支 <name> 不存在`
- **构建失败**: 展示错误,停止执行
- **401 Unauthorized**: 检查 .env 凭据
- **EPUBLISHCONFLICT**: 版本号已存在
