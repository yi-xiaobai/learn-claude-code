---
allowed-tools: Bash(git remote:*), Bash(curl:*)
description: List GitLab Merge Requests for current project
---

## Context

- Remote URL: !`git remote get-url origin`

## Parameters

User may specify: `/mr-list [--all]`
- Default: show current user's MRs only
- `--all`: show all open MRs

## Your task

List open Merge Requests for the current GitLab project.

1. **Get project info from remote URL**
   - Extract project path from git remote URL

2. **Get MR list from GitLab API**
   ```bash
   PROJECT_PATH=$(git remote get-url origin | sed 's|.*[:/]\([^/]*/[^/]*\)\.git|\1|')
   ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's|/|%2F|g')
   
   curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
     "https://$GITLAB_HOST/api/v4/projects/$ENCODED_PATH/merge_requests?state=opened"
   ```

3. **Format output as table**
   Show: MR number, title, author, source→target branch, updated time, pipeline status

## Output format

```
📋 **project/name** - Open MR List (3)

| # | Title | Author | Branch | Updated | Status |
|---|-------|--------|--------|---------|--------|
| #42 | feat: add login | zhangsan | feat/login → dev | 2026-03-12 | ✅ |
| #41 | fix: order calc | lisi | fix/order → dev | 2026-03-11 | ❌ |
```

## Configuration

Requires environment variables:
- `GITLAB_TOKEN`: GitLab Personal Access Token
- `GITLAB_HOST`: GitLab domain
