# MR List Plugin

List GitLab Merge Requests for current project.

## Overview

This plugin provides a quick way to view open Merge Requests for the current GitLab project, including pipeline status.

## Commands

### /mr-list

```bash
/mr-list [--all]
```

List open Merge Requests for current project.

**Parameters:**

| Parameter | Description |
|-----------|-------------|
| `--all` | Show all MRs (default: current user only) |

**Example:**

```bash
/mr-list
# → Shows your open MRs

/mr-list --all
# → Shows all open MRs
```

**Output:**

```
📋 **group/project** - Open MR List (3)

| # | Title | Author | Branch | Updated | Status |
|---|-------|--------|--------|---------|--------|
| #42 | feat: add login | zhangsan | feat/login → dev | 2026-03-12 | ✅ |
| #41 | fix: order calc | lisi | fix/order → dev | 2026-03-11 | ❌ |
```

## Installation

```bash
/plugin install mr-list@team-plugins
```

## Configuration

Set environment variables in `~/.config/git-agent/.env`:

```bash
GITLAB_TOKEN=glpat-xxxxxxxxxx
GITLAB_HOST=gitlab.company.com
```

## Troubleshooting

### 401 Unauthorized

- Token expired or invalid
- Token missing `api` permission

### No MRs shown

- Check if there are open MRs
- Use `--all` to see all MRs

## Requirements

- GitLab Personal Access Token (api permission)

## Author

Your Team

## Version

1.0.0
