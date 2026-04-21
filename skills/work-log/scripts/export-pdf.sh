#!/usr/bin/env bash
# 使用 MWeb Pro 将工作日志 Markdown 导出为 PDF
# 前置：已安装 MWeb Pro，终端已授予"辅助功能"权限
# 依赖：~/.claude/skills/work-log/.env 中的 WORK_LOG_PATH

set -euo pipefail

ENV_FILE="${WORK_LOG_ENV:-$HOME/.claude/skills/work-log/.env}"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "错误: 未找到配置文件 $ENV_FILE" >&2
    exit 1
fi
# shellcheck source=/dev/null
source "$ENV_FILE"

if [[ -z "${WORK_LOG_PATH:-}" ]]; then
    echo "错误: WORK_LOG_PATH 未在 $ENV_FILE 中配置" >&2
    exit 1
fi
if [[ ! -f "$WORK_LOG_PATH" ]]; then
    echo "错误: 工作日志文件不存在: $WORK_LOG_PATH" >&2
    exit 1
fi

target_pdf="${WORK_LOG_PATH%.md}.pdf"
target_dir="$(dirname "$target_pdf")"
target_name="$(basename "${target_pdf%.pdf}")"
rm -f "$target_pdf"

# 先杀掉现有 MWeb Pro 进程，确保干净的单窗口启动状态
# （热启动时 Untitled 等残留窗口会导致自动化失败）
if pgrep -x "MWeb Pro" >/dev/null; then
    pkill "MWeb Pro" 2>/dev/null || true
    # 等进程完全退出
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        pgrep -x "MWeb Pro" >/dev/null || break
        sleep 0.2
    done
fi

osascript - "$WORK_LOG_PATH" "$target_dir" "$target_name" "$target_pdf" <<'APPLESCRIPT'
on run argv
    set mdFile to item 1 of argv
    set targetDir to item 2 of argv
    set targetName to item 3 of argv
    set targetPdf to item 4 of argv

    tell application "MWeb Pro"
        activate
        open mdFile
    end tell
    delay 1.5

    tell application "System Events"
        tell process "MWeb Pro"
            set frontmost to true
            delay 0.2
            try
                click menu item (targetName & ".md") of menu "Window" of menu bar 1
                delay 0.2
            end try
            click menu item "Export as PDF..." of menu "Publish" of menu bar 1
            repeat 30 times
                if (count of sheets of window 1) > 0 then exit repeat
                delay 0.1
            end repeat
            delay 0.3
            click button "Save as..." of sheet 1 of window 1
            delay 0.8
            -- 用剪贴板粘贴中文文件名（keystroke 对 CJK 不可靠）
            keystroke "a" using {command down}
            delay 0.15
            set the clipboard to targetName
            delay 0.1
            keystroke "v" using {command down}
            delay 0.25
            -- Cmd+Shift+G 跳转目录
            keystroke "g" using {command down, shift down}
            delay 0.5
            set the clipboard to targetDir
            delay 0.1
            keystroke "v" using {command down}
            delay 0.2
            keystroke return
            delay 0.7
            keystroke return
        end tell
    end tell

    -- 轮询 PDF 文件出现（替代固定 2.5s 等待）
    repeat 60 times
        try
            set f to (POSIX file targetPdf) as alias
            exit repeat
        on error
            delay 0.1
        end try
    end repeat
end run
APPLESCRIPT
osascript_exit=$?

# MWeb Pro 的 Untitled 文档会阻塞常规 quit，用 pkill 直接收尾
pkill "MWeb Pro" 2>/dev/null || true

if [[ -f "$target_pdf" ]]; then
    size=$(stat -f%z "$target_pdf")
    echo "✅ 导出成功: $target_pdf ($size bytes)"
else
    echo "❌ 导出失败 (osascript exit=$osascript_exit)，未找到 $target_pdf" >&2
    exit 1
fi
