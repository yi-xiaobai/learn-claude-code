---
name: work-log
description: 管理工作日志，支持添加任务和生成未来一周日期模板。当用户请求记录工作内容、添加任务、生成日期模板时使用此技能。
tags: work, log, daily, task, journal
---

# 工作日志管理 Skill

**目标文件**: `/Users/luoyi/Documents/3_file/jwzg工作日志.md`

---

## 功能1: 添加/更新某天的任务

### 使用场景
- 用户说："今天做了xxx"、"记录一下2025.03.05的任务"
- 用户说："把xxx标记为完成"

### 操作步骤

1. **读取工作日志文件**
```bash
cat /Users/luoyi/Documents/3_file/jwzg工作日志.md
```

2. **解析用户输入**
   - 识别日期（支持自然语言：今天、昨天、周一、3月5号等）
   - 识别任务内容和状态

3. **查找日期位置**
   - 搜索 `### YYYY.MM.DD` 格式的标题
   - 如果存在，在该日期下追加任务
   - 如果不存在，在正确的时间顺序位置插入新日期

4. **写入任务**
   - 使用 edit 工具在对应位置添加任务

### 任务格式规范

```markdown
### YYYY.MM.DD

- [x] 已完成的任务
- [ ] 进行中/未完成的任务
  - [x] 已完成的子任务
  - [ ] 未完成的子任务
```

### 日期格式规范

- 标准格式: `### YYYY.MM.DD`
- 带备注格式: `### YYYY.MM.DD（备注）`
- 常见备注: 请假、半天假、休假、团建

### 任务状态识别

| 用户表达 | 状态 |
|---------|------|
| "完成了"、"已完成"、"做完了" | `[x]` |
| "在做"、"进行中"、"开发中" | `[ ]` |
| "待处理"、"计划"、"准备" | `[ ]` |

### 示例

**用户输入**: "记录今天的任务：完成了树形控件问题修复，正在做axure导入"

**操作**: 找到或创建 `### 2025.03.05`，添加：
```markdown
### 2025.03.05

- [x] 树形控件问题修复
- [ ] axure导入
```

---

## 功能2: 生成未来一周工作日模板

### 使用场景
- 用户说："生成下周的日期"、"添加未来一周模板"
- 用户说："创建下周一到周五的日期"

### 操作步骤

1. **确定起始日期**
   - 默认从明天开始
   - 或用户指定的日期

2. **计算工作日**
   - 生成未来5个工作日（跳过周六=6，周日=0）
   - 如果用户需要加班日，可手动指定

3. **检查重复**
   - 读取文件，检查日期是否已存在
   - 跳过已存在的日期

4. **生成模板**
   - 每周一前插入4个空行作为周分隔
   - 在文件末尾追加新日期

### 周分隔规则

每周的第一个工作日（通常是周一）前需要插入4个空行：

```markdown
### 2025.03.07

- [ ] 任务




### 2025.03.10

- [ ] 新一周的任务
```

### 示例

**用户输入**: "生成下周的日期模板"（假设今天是2025.03.05周三）

**生成内容**:
```markdown




### 2025.03.10

### 2025.03.11

### 2025.03.12

### 2025.03.13

### 2025.03.14
```

---

## 功能3: 特殊日期处理

### 请假/休假标记

**用户输入**: "3月19号请假"

**生成**:
```markdown
### 2025.03.19（请假）
```

### 常见特殊标记
- `（请假）`
- `（半天假）`
- `（半天年假）`
- `（休假）`
- `（团建）`
- `（元旦）`、`（春节）`等节日

---

## 功能4: 自动导出 PDF

### 使用场景
- 用户说："导出PDF"、"生成PDF"、"更新PDF"
- 完成任务编辑后需要同步 PDF 文件

### 前置条件
1. 已安装 Typora 应用
2. 终端已获得"辅助功能"权限（系统设置 > 隐私与安全性 > 辅助功能）

### 操作步骤

完成 md 文件编辑后，执行以下 AppleScript 命令自动导出 PDF：

```bash
# 先删除旧的 PDF 文件（避免弹出替换确认框）
rm -f "/Users/luoyi/Documents/3_file/jwzg工作日志.pdf"

# 然后执行导出
osascript <<'EOF'
set mdFile to "/Users/luoyi/Documents/3_file/jwzg工作日志.md"

tell application "Typora"
    activate
    open mdFile
end tell

delay 2

tell application "System Events"
    tell process "Typora"
        set frontmost to true
        delay 0.5
        click menu item "PDF" of menu "Export" of menu item "Export" of menu "File" of menu bar 1
        delay 2
        keystroke return
        delay 3
    end tell
end tell

-- 导出完成后退出 Typora
tell application "Typora"
    quit
end tell
EOF
```

### 权限设置说明

首次使用需要授予终端辅助功能权限：

1. 打开 **系统设置** (System Settings)
2. 进入 **隐私与安全性** > **辅助功能**
3. 点击 **+** 添加你的终端应用（Terminal、iTerm 或 Windsurf）
4. 确保开关已打开

### PDF 输出位置

PDF 文件会保存在与 md 文件相同的目录：
- 输入: `/Users/luoyi/Documents/3_file/jwzg工作日志.md`
- 输出: `/Users/luoyi/Documents/3_file/jwzg工作日志.pdf`

### 注意事项

1. **执行时不要操作电脑**: AppleScript 会模拟菜单点击，执行期间请勿切换窗口
2. **等待时间**: 脚本包含延迟以确保操作完成，大文件可能需要更长时间
3. **首次运行**: 可能会弹出权限请求对话框，请点击允许

---

## 注意事项

1. **日期排序**: 新日期必须按时间顺序插入正确位置
2. **格式一致**: 严格遵循现有文件的格式风格
3. **避免重复**: 添加前检查日期是否已存在
4. **保留内容**: 更新时不要删除已有任务，只追加新任务
5. **链接支持**: 任务可包含 Jira 链接格式 `[CZ-xxx](url)`

---

## 日期计算辅助

### JavaScript 日期工具代码（供参考）

```javascript
// 获取未来N个工作日
function getNextWorkdays(startDate, count) {
  const workdays = [];
  let current = new Date(startDate);
  
  while (workdays.length < count) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    // 跳过周六(6)和周日(0)
    if (day !== 0 && day !== 6) {
      workdays.push(formatDate(current));
    }
  }
  return workdays;
}

// 格式化日期为 YYYY.MM.DD
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// 判断是否是周一（需要添加周分隔）
function isMonday(dateStr) {
  const [y, m, d] = dateStr.split('.').map(Number);
  return new Date(y, m - 1, d).getDay() === 1;
}
```

---

## 快速命令示例

| 用户说 | 执行操作 |
|-------|---------|
| "今天完成了xxx" | 在今天日期下添加 `- [x] xxx` |
| "记录昨天：做了xxx" | 在昨天日期下添加 `- [ ] xxx` |
| "生成下周日期" | 追加下周一到周五的日期模板 |
| "3月10号请假" | 添加 `### 2025.03.10（请假）` |
| "把xxx标记完成" | 将对应任务的 `[ ]` 改为 `[x]` |
| "导出PDF" | 使用 AppleScript 自动导出 PDF |

