---
allowed-tools: Read, Edit, Bash(date:*)
description: Generate work log template for next week
---

## Context

- Today's date: !`date +%Y.%m.%d`
- Day of week: !`date +%u` (1=Mon, 7=Sun)

## Your task

Generate work log date templates for the next 5 working days.

1. **Calculate dates**
   - Start from tomorrow
   - Skip weekends (Saturday=6, Sunday=0)
   - Generate 5 working days

2. **Check existing dates**
   - Read the log file
   - Skip dates that already exist

3. **Add week separator**
   - Insert 4 blank lines before each Monday

4. **Append templates**
   ```markdown
   ### YYYY.MM.DD

   - [ ] 

   ```

## Week separator example

```markdown
### 2026.03.13

- [ ] Friday task



### 2026.03.16

- [ ] Monday task (new week)
```

## Configuration

Requires environment variable:
- `WORK_LOG_PATH`: Path to work log markdown file
