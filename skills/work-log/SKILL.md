---
name: work-log
description: 管理jwzg工作日志，支持添加任务和生成未来一周日期模板。当用户请求记录工作内容、添加任务、生成日期模板时使用此技能。
tags: work, log, daily, task, journal
---

# 工作日志管理 Skill

**目标文件**: `$WORK_LOG_PATH`（配置在 `.env` 文件中）

**加载配置**: `source ~/.claude/skills/work-log/.env`

---

## 功能1: 添加/更新任务

1. 加载配置并读取日志文件
2. 解析用户输入的日期（支持自然语言：今天、昨天、周一、3月5号等）和任务内容
3. 查找 `### YYYY.MM.DD` 标题，存在则追加，不存在则按时间顺序插入
4. 使用 edit 工具写入任务

### 任务格式

```markdown
### YYYY.MM.DD

- [x] 已完成的任务
- [ ] 未完成的任务
  - [x] 已完成的子任务
```

### 任务状态

- "完成了"、"已完成"、"做完了" → `[x]`
- "在做"、"进行中"、"待处理" → `[ ]`

### 特殊日期标记

日期标题可带备注：`### YYYY.MM.DD（请假）`

常见标记：请假、半天假、半天年假、休假、团建、补班

---

## 功能2: 生成未来一周工作日模板

1. 确定日期范围（默认从明天起7天）
2. **逐日查询节假日 API**（不要假设周一~周五都是工作日）：
   ```bash
   curl -s "http://api.haoshenqi.top/holiday?date=YYYY-MM-DD"
   ```
   API `status` 字段：0=工作日(生成) | 1=周末(跳过) | 2=补班工作日(生成，标注补班) | 3=假日(跳过)
3. 跳过已存在的日期
4. 仅对 status=0 和 status=2 生成模板，status=2 使用 `### YYYY.MM.DD（补班）`
5. 每周第一个工作日前插入4个空行作为周分隔（若周一是假日则周二起算）
6. 在文件末尾追加

### 批量查询脚本

```bash
start_date="2026-04-06"; days=7
for i in $(seq 0 $((days - 1))); do
  d=$(date -j -v+${i}d -f "%Y-%m-%d" "$start_date" "+%Y-%m-%d")
  status=$(curl -s "http://api.haoshenqi.top/holiday?date=$d" | grep -o '"status":[0-9]*' | grep -o '[0-9]*')
  case $status in 0) echo "$d => 工作日" ;; 1) echo "$d => 周末" ;; 2) echo "$d => 补班" ;; 3) echo "$d => 假日" ;; esac
done
```

---

## 功能3: 导出 PDF

**前置条件**: 已安装 MWeb Pro，终端已获得辅助功能权限。

**执行**:

```bash
bash ~/.claude/skills/work-log/scripts/export-pdf.sh
```

**原理**: `Publish > Export as PDF...` → 点 `Save as...` → 系统保存框用剪贴板粘贴中文文件名，`Cmd+Shift+G` 定位目录后回车保存。整个流程约 7 秒。

**实现要点**（见 `scripts/export-pdf.sh`）:

- 脚本开头先 `pkill "MWeb Pro"` 确保单窗口干净状态（残留的 Untitled 窗口会干扰自动化）
- 中文文件名必须通过剪贴板 `Cmd+V` 粘贴，AppleScript `keystroke` 对 CJK 不可靠
- 末尾用 AppleScript 原生 `POSIX file ... as alias` 轮询 PDF 出现，替代固定长延迟
- 结束时用 `pkill` 而非 `quit`，避开 Untitled 文档的未保存提示

执行期间不要操作电脑或剪贴板，AppleScript 会模拟菜单点击与粘贴。

---

## 注意事项

1. 新日期按时间顺序插入
2. 严格遵循现有文件格式
3. 添加前检查日期是否已存在，避免重复
4. 更新时只追加，不删除已有任务
5. 任务可包含 Jira 链接：`[CZ-xxx](url)`
