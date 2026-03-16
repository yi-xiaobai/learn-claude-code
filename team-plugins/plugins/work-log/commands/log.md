---
allowed-tools: Read, Edit, Bash(date:*), Bash(cat:*)
description: Add or update work log entries
---

## Context

- Today's date: !`date +%Y.%m.%d`
- Day of week: !`date +%u` (1=Mon, 7=Sun)

## Your task

Manage work log entries. The log file path is configured in `$WORK_LOG_PATH`.

### Adding tasks

When user says "今天做了xxx" or "记录任务":

1. **Read the log file**
   ```bash
   cat "$WORK_LOG_PATH"
   ```

2. **Parse user input**
   - Identify date (supports: 今天, 昨天, 周一, 3月5号, etc.)
   - Identify task content and status

3. **Find or create date section**
   - Format: `### YYYY.MM.DD`
   - Insert in chronological order if new

4. **Add task**
   - `- [x]` for completed
   - `- [ ]` for in progress

### Task status keywords

| User says | Status |
|-----------|--------|
| 完成了, 已完成, 做完了 | `[x]` |
| 在做, 进行中, 开发中 | `[ ]` |
| 待处理, 计划, 准备 | `[ ]` |

### Special dates

- 请假: `### YYYY.MM.DD（请假）`
- 半天假: `### YYYY.MM.DD（半天假）`
- 休假: `### YYYY.MM.DD（休假）`
- 团建: `### YYYY.MM.DD（团建）`

## Configuration

Requires environment variable:
- `WORK_LOG_PATH`: Path to work log markdown file
