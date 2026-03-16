---
allowed-tools: Bash(curl:*), Bash(python3:*)
description: Fetch GitHub Trending and send to Feishu
---

## Your task

Fetch GitHub Trending top 10 projects and send to Feishu group.

### Step 1: Fetch trending data

Use curl or Python to scrape GitHub Trending page:

```bash
curl -s "https://github.com/trending" | \
  grep -A 20 'Box-row' | \
  head -100
```

Or use a Python script for better parsing.

### Step 2: Extract project info

For each project, extract:
- Repository name and URL
- Description
- Programming language
- Star count
- Today's stars

### Step 3: Format as Feishu card

Create a Feishu card message with the top 10 projects.

### Step 4: Send to Feishu

```bash
curl -X POST "$FEISHU_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "msg_type": "interactive",
    "card": {
      "header": {
        "title": {"content": "🔥 GitHub Trending Top 10", "tag": "plain_text"}
      },
      "elements": [
        // Project cards here
      ]
    }
  }'
```

## Configuration

Requires environment variable:
- `FEISHU_WEBHOOK_URL`: Feishu group webhook URL

## Cron setup (optional)

```bash
# Run every workday at 10:00 AM
0 10 * * 1-5 /path/to/script
```
