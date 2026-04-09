---
name: turtle
description: turtle项目自动化工具。支持构建、发布、构建发布。触发词："构建turtle"、"发布turtle"、"turtle"。
version: 3.0.0
---

# Turtle 项目自动化

统一管理turtle项目的构建、发布流程。**首次自动配置，后续零操作。**

## 配置

**项目路径** - 首次自动搜索并缓存到 `~/.claude/turtle/project.path`

**NPM认证** - 执行一次: `npm login --registry=<你的私有仓库地址>`

重置配置: `rm ~/.claude/turtle/project.path`

## 功能

### 1. 构建 (build)
切换分支 → 构建 → 提交推送

用法: `构建turtle的<分支名>`

### 2. 发布 (publish)
版本更新 → 发布npm → 推送

用法: `发布turtle到<分支名>`

### 3. 构建发布 (build-publish)
构建 → 版本更新 → 发布 → 推送

用法: `构建发布turtle到<分支名>`

## Workflow

Claude执行: `bash ~/.claude/skills/turtle/scripts/turtle.sh <action> <branch>`

- `action`: build | publish | build-publish
- `branch`: **必填**，分支名称

## Troubleshooting

- **未找到项目**: 确保turtle已克隆到 ~/Documents、~/Projects 或 ~/Code
- **未登录npm**: 执行 `npm login --registry=<地址>` 一次
- **路径失效**: 删除缓存 `rm ~/.claude/turtle/project.path`
