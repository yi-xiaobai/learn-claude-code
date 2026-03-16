# Branch Create Plugin

Create Git branches with auto-versioning and IDE integration.

## Overview

This plugin automates Git branch creation with automatic version numbering. It creates the remote branch first, then switches locally, ensuring clean branch tracking.

## Commands

### /branch-create

```bash
/branch-create [type] [base_branch] [ide]
```

Creates a new Git branch with auto-generated version number.

**Parameters:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `type` | Branch type: `feat`, `fix`, `hotfix` | Required |
| `base_branch` | Base branch to create from | `dev` |
| `ide` | IDE to open: `windsurf`, `vscode` | `windsurf` |

**What it does:**

1. Analyzes existing branches to determine next version number
2. Translates Chinese description to English kebab-case
3. Creates remote branch first (ensures clean tracking)
4. Switches to local branch
5. Opens project in IDE

**Example:**

```bash
/branch-create feat
# → Asks for description
# → Creates: feat-add-user-login-v3
# → Opens in Windsurf

/branch-create fix master vscode
# → Creates fix branch based on master
# → Opens in VS Code
```

## Installation

```bash
/plugin install branch-create@team-plugins
```

## Best Practices

- Use meaningful descriptions, Claude will translate to English
- For hotfix, base on `master` instead of `dev`
- Version numbers auto-increment, no manual management needed

## Troubleshooting

### Base branch doesn't exist

```bash
# Check available remote branches
git branch -r
```

### Permission denied

- Check GitLab Token has `write_repository` permission
- Check branch protection rules

### IDE command not found

- Windsurf: Ensure installed and in PATH
- VS Code: Run `Shell Command: Install 'code' command in PATH`

## Requirements

- Git 2.x+
- GitLab project push permission
- Windsurf or VS Code (optional)

## Author

Your Team

## Version

1.0.0
