---
allowed-tools: Bash(git remote:*), Bash(curl:*)
description: List GitLab Merge Requests for current project
---

## Context

- Remote URL: !`git remote get-url origin`
- Current GitLab user: !`curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "https://$GITLAB_HOST/api/v4/user" 2>/dev/null | grep -o '"username":"[^"]*"' | cut -d'"' -f4`

## Parameters

User may specify: `/mr-list [--all]`
- Default: show current user's MRs only, sorted by updated time (desc)
- `--all`: show all open MRs

## Your task

List open Merge Requests for the current GitLab project.

### Step 1: Get project info

```bash
PROJECT_PATH=$(git remote get-url origin | sed 's|.*[:/]\([^/]*/[^/]*\)\.git|\1|')
ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's|/|%2F|g')
```

### Step 2: Get current user ID

```bash
USER_ID=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$GITLAB_HOST/api/v4/user" | grep -o '"id":[0-9]*' | cut -d: -f2)
```

### Step 3: Get MR list from GitLab API

**Default (current user's MRs):**
```bash
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$GITLAB_HOST/api/v4/projects/$ENCODED_PATH/merge_requests?state=opened&author_id=$USER_ID&order_by=updated_at&sort=desc"
```

**With --all flag:**
```bash
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$GITLAB_HOST/api/v4/projects/$ENCODED_PATH/merge_requests?state=opened&order_by=updated_at&sort=desc"
```

**API Parameters:**
- `state=opened`: Only open MRs
- `author_id=$USER_ID`: Filter by author (default)
- `order_by=updated_at`: Sort by update time
- `sort=desc`: Newest first

### Step 4: Format output as table

Show: MR number, title, author, source→target branch, updated time, pipeline status

## Output format

```
📋 **project/name** - 我的 MR 列表 (3)

| # | Title | Branch | Updated | Pipeline |
|---|-------|--------|---------|----------|
| #42 | feat: add login | feat/login → dev | 2小时前 | ✅ passed |
| #38 | fix: order calc | fix/order → dev | 1天前 | ❌ failed |
```

With `--all`:
```
📋 **project/name** - 所有 MR 列表 (5)

| # | Title | Author | Branch | Updated | Pipeline |
|---|-------|--------|--------|---------|----------|
| #42 | feat: add login | zhangsan | feat/login → dev | 2小时前 | ✅ |
| #41 | fix: bug | lisi | fix/bug → dev | 3小时前 | ✅ |
```

## Configuration

Requires environment variables:
- `GITLAB_TOKEN`: GitLab Personal Access Token
- `GITLAB_HOST`: GitLab domain (e.g., gitlab.company.com)
