---
name: github-trending
description: 每日推送 GitHub 热榜 Top 10 到飞书群，支持指定编程语言筛选。纯 Python 标准库实现，无需安装任何依赖。
tags: github, trending, feishu, notification, cron, python
---

# GitHub 热榜推送 Skill

每天定时获取 GitHub Trending 热榜，推送到飞书群。

**特点**：使用 Python 标准库实现，无需 pip install 任何依赖。

---

## 快速开始

### 1. 配置飞书 Webhook

1. 打开飞书群 -> 设置 -> 群机器人 -> 添加机器人
2. 选择「自定义机器人」
3. 复制 Webhook 地址
4. 创建 `.env` 文件：

```bash
cd /Users/luoyi/Documents/13_AI/learn-claude-code/skills/github-trending
cp .env.example .env
# 编辑 .env，填入 Webhook URL
```

### 2. 测试运行

```bash
# 测试模式（不推送，只打印结果）
python3 github-trending.py --dry-run

# 实际推送
python3 github-trending.py

# 指定语言
python3 github-trending.py --language javascript
python3 github-trending.py --language python
```

---

## 命令参数

| 参数 | 说明 | 示例 |
|-----|------|-----|
| `--dry-run` | 测试模式，不实际推送 | `python3 github-trending.py --dry-run` |
| `--language <lang>` | 指定编程语言 | `python3 github-trending.py --language javascript` |

---

## 定时任务配置（每天 9:10）

### 方式一：macOS/Linux crontab

```bash
# 编辑 crontab
crontab -e

# 添加定时任务：每天 9:10 执行
10 9 * * * cd /Users/luoyi/Documents/13_AI/learn-claude-code/skills/github-trending && /usr/bin/python3 github-trending.py >> /tmp/github-trending.log 2>&1
```

### 方式二：macOS launchd（更可靠）

创建文件 `~/Library/LaunchAgents/com.user.github-trending.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.github-trending</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/luoyi/Documents/13_AI/learn-claude-code/skills/github-trending/github-trending.py</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>10</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/github-trending.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/github-trending.log</string>
    <key>WorkingDirectory</key>
    <string>/Users/luoyi/Documents/13_AI/learn-claude-code/skills/github-trending</string>
</dict>
</plist>
```

加载任务：
```bash
launchctl load ~/Library/LaunchAgents/com.user.github-trending.plist

# 查看状态
launchctl list | grep github-trending

# 卸载任务
launchctl unload ~/Library/LaunchAgents/com.user.github-trending.plist
```

---

## 飞书群机器人配置

1. 打开目标飞书群
2. 点击右上角 **「...」** → **「设置」**
3. 点击 **「群机器人」** → **「添加机器人」**
4. 选择 **「自定义机器人」**
5. 填写机器人名称（如：GitHub 热榜）
6. 复制 **Webhook 地址**
7. 填入 `.env` 文件

---

## 消息效果预览

```
🔥 GitHub 今日热榜 Top 10
📅 2026/03/05 | 数据来源: github.com/trending
────────────────────────────
1. facebook/react
   ⭐ 243,628 (+104) | 📝 JavaScript
   The library for web and native user interfaces.

2. microsoft/vscode
   ⭐ 165,432 (+89) | 📝 TypeScript
   Visual Studio Code
   
...
────────────────────────────
💡 点击项目名称可直接访问 GitHub 仓库
```

---

## 自然语言使用

Claude 可以执行以下命令：

| 用户说 | 执行命令 |
|-------|---------|
| "推送 GitHub 热榜到飞书" | `python3 github-trending.py` |
| "获取今日 GitHub 热门项目" | `python3 github-trending.py --dry-run` |
| "推送 JavaScript 热榜" | `python3 github-trending.py --language javascript` |
| "推送 Python 热榜" | `python3 github-trending.py --language python` |

---

## 支持的语言筛选

常用语言：`javascript`, `typescript`, `python`, `java`, `go`, `rust`, `c++`, `c`, `swift`, `kotlin`

完整列表参考：https://github.com/trending

---

## 故障排查

### 1. 获取不到数据
- 检查网络连接
- GitHub 可能有反爬限制，稍后重试

### 2. 飞书推送失败
- 检查 Webhook URL 是否正确
- 检查机器人是否被禁用
- 查看错误信息

### 3. 定时任务不执行
- 检查 crontab 是否正确配置
- 检查 Python 路径：`which python3`
- 查看日志：`cat /tmp/github-trending.log`
