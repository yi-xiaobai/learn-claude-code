#!/bin/bash
# 同步指定技能到多个目标目录

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
ENV_FILE="$(dirname "$SCRIPT_DIR")/.env"

# 从 .env 读取配置值（避免 source 执行问题）
get_config() {
    local key="$1"
    grep "^$key=" "$ENV_FILE" | head -1 | cut -d'=' -f2-
}

# 展开路径中的 ~
expand_path() {
    local path="$1"
    echo "${path/#\~/$HOME}"
}

# 读取配置
SYNC_TARGET_PATHS=$(get_config "SYNC_TARGET_PATHS")
SYNC_SKILLS=$(get_config "SYNC_SKILLS")

# 检查配置
if [ -z "$SYNC_TARGET_PATHS" ]; then
    echo "❌ 未配置 SYNC_TARGET_PATHS"
    exit 1
fi

if [ -z "$SYNC_SKILLS" ]; then
    echo "❌ 未配置 SYNC_SKILLS"
    exit 1
fi

# 同步到每个目标路径
IFS=':'
for target in $SYNC_TARGET_PATHS; do
    target=$(expand_path "$target")
    [ -z "$target" ] && continue

    mkdir -p "$target"

    echo "🔄 同步技能到 $target"
    echo ""

    for skill in $SYNC_SKILLS; do
        [ -z "$skill" ] && continue

        if [ -d "$SKILL_DIR/$skill" ]; then
            cp -r "$SKILL_DIR/$skill" "$target/"
            echo "✅ $skill"
        else
            echo "⚠️  $skill 不存在，跳过"
        fi
    done
    echo ""
done

unset IFS

echo "✨ 同步完成: $(date '+%Y-%m-%d %H:%M:%S')"
