---
name: github-trending-feishu
description: |
  每个工作日上午10点自动获取GitHub Trending热榜前十名，以精美卡片格式推送到飞书群。

  触发场景：
  - 用户说"发送GitHub热榜到飞书"、"推送今日热榜"、"发送trending"
  - 用户想设置定时推送GitHub热榜
  - 用户询问如何自动发送GitHub热门项目到飞书
---

# GitHub Trending 飞书推送

自动获取 GitHub Trending 热榜并通过飞书机器人推送到群聊。

## 使用方式

### 1. 配置飞书 Webhook

首先需要获取飞书群机器人的 Webhook 地址：
1. 在飞书群中添加「自定义机器人」
2. 获取 Webhook URL（格式类似 `https://open.feishu.cn/open-apis/bot/v2/hook/xxx`）
3. 设置环境变量或直接在脚本中配置

### 2. 执行推送

运行以下命令立即推送当前热榜：

```bash
python skills/github-trending-feishu/scripts/fetch_and_send.py --webhook "YOUR_WEBHOOK_URL"
```

或设置环境变量后直接运行：

```bash
export FEISHU_WEBHOOK="YOUR_WEBHOOK_URL"
python skills/github-trending-feishu/scripts/fetch_and_send.py
```

### 3. 设置定时任务（工作日10:00）

在 Claude Code 中使用内置定时器：

```
帮我设置每个工作日10点发送GitHub热榜到飞书，webhook地址是: YOUR_WEBHOOK_URL
```

或者使用系统 crontab（需要脚本路径和环境变量）：

```bash
# 编辑 crontab
crontab -e

# 添加以下行（工作日10:00执行）
0 10 * * 1-5 FEISHU_WEBHOOK="YOUR_WEBHOOK_URL" python3 skills/github-trending-feishu/scripts/fetch_and_send.py >> /tmp/github-trending.log 2>&1
```

## 消息格式

飞书卡片消息包含：
- 标题：当日 GitHub Trending Top 10
- 每个项目显示：
  - 仓库名称（可点击链接）
  - 星标数、Fork 数
  - 今日新增星标
  - 项目描述
  - 主要语言

## 自定义配置

编辑 `scripts/fetch_and_send.py` 可以修改：
- `SINCE`: 时间范围（daily/weekly/monthly）
- `LANGUAGE`: 特定语言过滤（留空为全部）
- 卡片样式和字段
