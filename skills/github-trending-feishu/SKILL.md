---
name: github-trending-feishu
description: |
  获取 GitHub Trending 热榜并推送到飞书群。支持日/周/月热榜。

  触发场景：
  - 用户说"发送GitHub热榜到飞书"、"推送今日热榜"、"发送trending"
  - 用户说"发送周热榜"、"推送月热榜"
  - 用户想设置定时推送GitHub热榜
args: [since] [webhook]
---

# GitHub Trending 飞书推送

自动获取 GitHub Trending 热榜并通过飞书机器人推送到群聊。

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `since` | 时间范围：`daily`(今日)/`weekly`(本周)/`monthly`(本月) | `daily` |
| `webhook` | 飞书 Webhook URL | 从环境变量读取 |

## 使用方式

### 立即发送（默认日热榜）

```bash
python3 skills/github-trending-feishu/scripts/fetch_and_send.py --webhook "YOUR_WEBHOOK_URL"
```

### 发送周热榜

```bash
python3 skills/github-trending-feishu/scripts/fetch_and_send.py --since weekly --webhook "YOUR_WEBHOOK_URL"
```

### 发送月热榜

```bash
python3 skills/github-trending-feishu/scripts/fetch_and_send.py --since monthly --webhook "YOUR_WEBHOOK_URL"
```

## 定时任务设置

### 日热榜（工作日 10:00）

```bash
0 10 * * 1-5 python3 /path/to/fetch_and_send.py --webhook "YOUR_URL" >> /tmp/github-trending.log 2>&1
```

### 周热榜（每周一 10:00）

```bash
0 10 * * 1 python3 /path/to/fetch_and_send.py --since weekly --webhook "YOUR_URL" >> /tmp/github-trending.log 2>&1
```

### 月热榜（每月 1 号 10:00）

```bash
0 10 1 * * python3 /path/to/fetch_and_send.py --since monthly --webhook "YOUR_URL" >> /tmp/github-trending.log 2>&1
```

## 消息格式

飞书卡片消息包含：
- 标题：GitHub Trending（日/周/月）
- 每个项目显示：
  - 仓库名称（可点击链接）
  - 星标数、Fork 数
  - 今日/本周/本月新增星标
  - 项目描述
  - 主要语言

## 环境变量

| 变量 | 说明 |
|------|------|
| `FEISHU_WEBHOOK` | 飞书 Webhook URL |
| `FEISHU_SECRET` | 签名密钥（可选，开启签名校验时需要） |

## 注意事项

- 飞书机器人若开启关键词验证，消息需包含关键词才能发送
- 本脚本消息包含 `github trending` 关键词
