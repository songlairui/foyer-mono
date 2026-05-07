#!/usr/bin/env bash
# 将项目 skills/ 下的每个 skill 以软链接同步到 ~/.agents/skills/
set -euo pipefail

PROJECT_SKILLS="$(cd "$(dirname "$0")" && pwd)/skills"
TARGET_DIR="$HOME/.agents/skills"

mkdir -p "$TARGET_DIR"

for skill_dir in "$PROJECT_SKILLS"/*/; do
    skill_name=$(basename "$skill_dir")
    link_path="$TARGET_DIR/$skill_name"

    # 如果已是正确软链接，跳过
    if [ -L "$link_path" ] && [ "$(readlink "$link_path")" = "$skill_dir" ]; then
        echo "✓ $skill_name (已是最新)"
        continue
    fi

    # 否则删除旧的（目录或错误软链接），创建新软链接
    rm -rf "$link_path"
    ln -s "$skill_dir" "$link_path"
    echo "→ $skill_name 已同步"
done

echo "完成: $(ls -1 "$TARGET_DIR" | wc -l | tr -d ' ') 个 skill 在 $TARGET_DIR"
