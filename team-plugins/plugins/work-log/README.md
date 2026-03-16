# Work Log Plugin

Work log management - add tasks and generate weekly templates.

## Overview

This plugin helps manage daily work logs in markdown format. Add tasks with natural language, mark completion status, and generate weekly templates automatically.

## Commands

### /log

```bash
/log
```

Add or update work log entries.

**What it does:**

1. Parses natural language input
2. Identifies date and task content
3. Adds task to appropriate date section
4. Handles special dates (leave, holiday)

**Examples:**

```bash
# Add completed task
"今天完成了用户登录功能"
# → Adds: - [x] 用户登录功能

# Add in-progress task
"正在做订单模块"
# → Adds: - [ ] 订单模块

# Mark leave
"3月19号请假"
# → Creates: ### 2026.03.19（请假）
```

### /generate-week

```bash
/generate-week
```

Generate date templates for next 5 working days.

**What it does:**

1. Calculates next 5 working days (skips weekends)
2. Checks for existing dates
3. Adds week separators (4 blank lines before Monday)
4. Appends templates

## Installation

```bash
/plugin install work-log@team-plugins
```

## Configuration

Set environment variable in `~/.config/git-agent/.env`:

```bash
WORK_LOG_PATH=~/Documents/工作日志.md
```

## Log Format

```markdown
### 2026.03.16

- [x] Completed task
- [ ] In progress task
  - [x] Completed subtask
  - [ ] Pending subtask



### 2026.03.17

- [ ] Next day task
```

## Date Recognition

| Input | Recognized as |
|-------|---------------|
| 今天 | Today |
| 昨天 | Yesterday |
| 周一 | This Monday |
| 3月5号 | March 5th |

## Task Status

| Input | Status |
|-------|--------|
| 完成了, 已完成 | `[x]` |
| 在做, 进行中 | `[ ]` |

## Requirements

- Work log markdown file

## Author

Your Team

## Version

1.0.0
