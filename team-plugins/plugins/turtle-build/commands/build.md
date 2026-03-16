---
allowed-tools: Bash(git fetch:*), Bash(git branch:*), Bash(git checkout:*), Bash(git status:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(yarn build:*), Bash(cd:*)
description: Build and push Turtle project
---

## Context

- Turtle project path: $TURTLE_PROJECT_PATH

## Your task

Execute Turtle project build workflow. User provides branch name.

**IMPORTANT: Execute steps in strict order. Stop immediately on any error.**

### Step 1: Switch to branch

```bash
cd $TURTLE_PROJECT_PATH
git fetch origin
git branch -r | grep "<branch_name>"
```

If branch doesn't exist on remote, **STOP** and inform user.

```bash
git checkout <branch_name>
```

### Step 2: Build project

```bash
cd $TURTLE_PROJECT_PATH
yarn build
```

If build fails, **STOP** and show error to user.

### Step 3: Commit and push

```bash
cd $TURTLE_PROJECT_PATH
git status
git diff --stat
git add .
git commit -m "chore(build): <description based on changes>"
git push
```

**Commit message examples:**
- `chore(build): update dist bundle for user-auth feature`
- `chore(build): recompile assets after dependency update`

### Step 4: Report success

```
✅ Turtle build complete
Branch: <branch_name>
Commit: <commit_message>
```

## Configuration

Requires environment variable:
- `TURTLE_PROJECT_PATH`: Path to Turtle project
