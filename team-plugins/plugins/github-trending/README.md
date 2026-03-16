# GitHub Trending Plugin

Fetch GitHub Trending and send to Feishu group.

## Overview

This plugin fetches the top 10 trending repositories from GitHub and sends them to a Feishu group as a formatted card message.

## Commands

### /trending

```bash
/trending
```

Fetch GitHub Trending and send to Feishu.

**What it does:**

1. Scrapes GitHub Trending page
2. Extracts top 10 project info
3. Formats as Feishu card message
4. Sends to configured webhook

**Output includes:**

- Repository name and link
- Description
- Programming language
- Star count
- Today's new stars

## Installation

```bash
/plugin install github-trending@team-plugins
```

## Configuration

Set environment variable in `~/.config/git-agent/.env`:

```bash
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

## Cron Setup (Optional)

For automatic daily updates:

```bash
# Run every workday at 10:00 AM
0 10 * * 1-5 claude /trending
```

## Troubleshooting

### Webhook fails

- Check webhook URL is correct
- Verify Feishu bot is active

### Scraping fails

- GitHub may have changed page structure
- Check network connectivity

## Requirements

- Feishu group webhook
- Network access to GitHub

## Author

Your Team

## Version

1.0.0
