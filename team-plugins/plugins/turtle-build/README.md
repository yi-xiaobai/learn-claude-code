# Turtle Build Plugin

Turtle project build workflow - checkout, build, and push.

## Overview

This plugin automates the Turtle project build workflow. It switches to the specified branch, runs the build, and pushes the build artifacts.

## Commands

### /build

```bash
/build <branch_name>
```

Execute Turtle project build workflow.

**Parameters:**

| Parameter | Description |
|-----------|-------------|
| `branch_name` | Remote branch to build (required) |

**What it does:**

1. Fetches and switches to specified branch
2. Runs `yarn build`
3. Commits build artifacts with descriptive message
4. Pushes to remote

**Example:**

```bash
/build feature/new-ui
# → Checkout feature/new-ui
# → yarn build
# → Commit: chore(build): update dist for new-ui
# → Push
# → ✅ Build complete
```

## Installation

```bash
/plugin install turtle-build@team-plugins
```

## Configuration

Set environment variable in `~/.config/git-agent/.env`:

```bash
TURTLE_PROJECT_PATH=~/path/to/turtle-project
```

## Troubleshooting

### Branch doesn't exist

- Verify branch name is correct
- Check if branch exists on remote: `git branch -r`

### Build fails

- Check error message
- Fix issues manually and retry

### Push rejected

- May have conflicts
- Pull first or resolve manually

## Requirements

- Node.js & Yarn
- Turtle project configured
- Git access to repository

## Author

Your Team

## Version

1.0.0
