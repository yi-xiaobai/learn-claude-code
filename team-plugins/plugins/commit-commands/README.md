# Commit Commands Plugin

Streamline your git workflow with commands for committing, pushing, and creating merge requests.

## Overview

This plugin automates common git operations, reducing context switching and manual command execution. Instead of running multiple git commands, use a single slash command to handle your entire workflow.

## Commands

### /commit

```bash
/commit
```

Creates a git commit with an automatically generated commit message based on staged and unstaged changes.

**What it does:**

1. Analyzes current git status
2. Reviews both staged and unstaged changes
3. Examines recent commit messages to match your repository's style
4. Drafts an appropriate commit message (Conventional Commits format)
5. Stages relevant files
6. Creates the commit

**Features:**

- Automatically drafts commit messages that match your repo's style
- Follows Conventional Commits practices
- Avoids committing files with secrets (.env, credentials)

### /commit-push

```bash
/commit-push
```

Commits and pushes to remote in one step.

**What it does:**

1. Analyzes changes and generates commit message
2. Stages and commits
3. Pushes to origin

**Example:**

```bash
/commit-push
# → Analyzes changes
# → Commits: feat(auth): add user login
# → Pushes to origin
# → ✅ Done
```

### /commit-push-mr

```bash
/commit-push-mr [target_branch]
```

Complete workflow command that commits, pushes, and creates a GitLab Merge Request in one step.

**Parameters:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `target_branch` | MR target branch | `dev` |

**What it does:**

1. Stages and commits changes with an appropriate message
2. Pushes the branch to origin
3. Creates a Merge Request using GitLab API
4. Provides the MR URL

**Default MR settings:**

- Delete source branch after merge: ✅
- Squash commits: ✅

**Examples:**

```bash
/commit-push-mr
# → Creates MR to dev (default)

/commit-push-mr master
# → Creates MR to master

/commit-push-mr release/v1.0
# → Creates MR to release/v1.0
```

## Installation

```bash
/plugin install commit-commands@team-plugins
```

## Configuration

For `/commit-push-mr`, set environment variables in `~/.config/git-agent/.env`:

```bash
GITLAB_TOKEN=glpat-xxxxxxxxxx
GITLAB_HOST=gitlab.company.com
```

## Best Practices

### Using /commit

- Review the generated commit message
- Use for quick commits during development

### Using /commit-push

- Use when you're ready to share your work
- Good for feature branches

### Using /commit-push-mr

- Use when feature is complete and ready for review
- Ensures clean MR with squashed commits

## Workflow Integration

### Quick commit workflow

```bash
# Make changes
/commit
```

### Feature branch workflow

```bash
# During development
/commit-push

# When ready for review
/commit-push-mr
```

## Troubleshooting

### /commit creates empty commit

- Check if there are actual changes: `git status`
- Ensure files aren't gitignored

### /commit-push fails

- Check if branch is tracking remote
- Verify push permissions

### /commit-push-mr fails to create MR

- Check GITLAB_TOKEN is valid and has `api` permission
- Check GITLAB_HOST is correct
- Ensure branch is pushed to remote

## Requirements

- Git 2.x+
- GitLab Personal Access Token (for /commit-push-mr)

## Author

Your Team

## Version

1.0.0
