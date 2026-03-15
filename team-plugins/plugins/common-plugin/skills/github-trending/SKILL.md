---
name: github-trending
description: 每个工作日上午10点自动获取GitHub Trending热榜前十名，以精美卡片格式推送到飞书群。触发场景：用户说"发送GitHub热榜到飞书"、"推送今日热榜"、"发送trending"。
---

# GitHub Trending 飞书推送

每个工作日上午10点自动获取GitHub Trending热榜前十名，以精美卡片格式推送到飞书群。

## 配置

在技能目录下创建 `.env` 文件：

```bash
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

## 执行

```bash
python3 ~/.claude/skills/github-trending/scripts/fetch_and_send.py
```

## 功能说明

1. **抓取热榜**: 从 GitHub Trending 页面获取前 10 个热门项目
2. **格式化**: 转换为飞书卡片消息格式
3. **推送**: 发送到配置的飞书群 Webhook

## 输出示例

飞书群收到的卡片包含：
- 项目名称和链接
- 项目描述
- 编程语言
- Star 数量
- 今日新增 Star

## 触发短语

| 用户说 | 行为 |
|--------|------|
| "发送GitHub热榜到飞书" | 立即执行推送 |
| "推送今日热榜" | 同上 |
| "发送trending" | 同上 |

## 定时任务配置（可选）

如需定时执行，可配置 crontab：

```bash
# 每个工作日上午 10:00 执行
0 10 * * 1-5 python3 ~/.claude/skills/github-trending/scripts/fetch_and_send.py
```
