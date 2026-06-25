---
name: turtle
description: Run turtle build and bump `package.json` version in one step. Use when Codex needs to handle the turtle release flow.
---

# Turtle

Use this skill for only one thing:

1. Build turtle and update `package.json` version.

Run:

```bash
bash ~/.claude/skills/turtle/scripts/turtle.sh <branch> [patch|minor|major]
```

If the user only says "升级版本", use `patch`.

If the user does not give a branch, ask for it.

If build fail stop and report the error.
