---
name: turtle-publish
description: 发布 turtle 项目到 npm 私有仓库。触发词: "发布turtle"、"turtle publish"、"npm publish turtle"。
version: 0.1.0
---

# Turtle NPM 发布

发布 turtle 包到私有 npm 仓库。

**Key concepts:**
- 自动递增 patch 版本
- 私有仓库认证登录
- 失败自动重试 (删除 ~/.nvmrc)
- 发布后自动 git push

## 配置

从 `~/.claude/skills/turtle-publish/.env` 读取:
- `TURTLE_PROJECT_PATH` - 项目路径
- `NPM_REGISTRY` - 私有仓库地址
- `NPM_USERNAME` / `NPM_PASSWORD` / `NPM_EMAIL` - 认证凭据

## Workflow

```bash
# 1. 进入项目
source ~/.claude/skills/turtle-publish/.env && cd $TURTLE_PROJECT_PATH

# 2. 版本更新
npm version patch --no-git-tag-version

# 3. 配置并登录
npm config set registry $NPM_REGISTRY && \
echo -e "$NPM_USERNAME\n$NPM_PASSWORD\n$NPM_EMAIL" | npm adduser --registry $NPM_REGISTRY

# 4. 发布 (失败时删除 ~/.nvmrc 重试)
npm publish || (rm -f ~/.nvmrc && npm publish)

# 5. 提交推送
git add package.json && git commit -m "chore(release): bump version" && git push
```

## Troubleshooting

- **401 Unauthorized**: 检查 .env 凭据
- **EPUBLISHCONFLICT**: 版本号已存在,手动修改 package.json
- **网络错误**: 检查仓库地址和 VPN 连接
