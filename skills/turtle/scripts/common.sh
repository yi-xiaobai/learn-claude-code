#!/bin/bash
# Turtle skills 公共函数库

# 获取turtle项目路径（自动搜索并缓存）
get_turtle_path() {
    local CACHE="$HOME/.claude/turtle/project.path"
    
    if [ -f "$CACHE" ]; then
        cat "$CACHE"
        echo "📂 使用缓存路径: $(cat "$CACHE")" >&2
        return 0
    fi
    
    echo "🔍 首次使用，正在搜索turtle项目..." >&2
    
    for dir in "$HOME/Documents" "$HOME/Projects" "$HOME/Code"; do
        [ ! -d "$dir" ] && continue
        
        while IFS= read -r git_dir; do
            local proj=$(dirname "$git_dir")
            local url=$(git -C "$proj" remote get-url origin 2>/dev/null || echo "")
            if echo "$url" | grep -iq "turtle"; then
                mkdir -p "$(dirname "$CACHE")"
                echo "$proj" > "$CACHE"
                echo "✅ 找到并保存: $proj" >&2
                echo "$proj"
                return 0
            fi
        done < <(find "$dir" -maxdepth 3 -type d -name ".git" 2>/dev/null)
    done
    
    echo "❌ 未找到turtle项目" >&2
    return 1
}
