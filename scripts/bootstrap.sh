#!/usr/bin/env bash
# 新设备 foyer 环境初始化
# 用法：bash bootstrap.sh <foyer-data-repo-url> [projects-root]
# 示例：bash bootstrap.sh git@github.com:you/foyer-data.git

set -euo pipefail

FOYER_DATA_URL="${1:-}"
FOYER_ROOT="${HOME}/.foyer"
PROJECTS_ROOT="${2:-${HOME}/repo/projects}"

if [ -z "$FOYER_DATA_URL" ]; then
  echo "用法: bash bootstrap.sh <foyer-data-repo-url> [projects-root]"
  exit 1
fi

echo "▸ 同步 ~/.foyer/ 数据..."
if [ -d "${FOYER_ROOT}/.git" ]; then
  git -C "${FOYER_ROOT}" pull
else
  git clone "${FOYER_DATA_URL}" "${FOYER_ROOT}"
fi

echo "▸ 确保 projects 根目录存在..."
mkdir -p "${PROJECTS_ROOT}"

echo "▸ 安装 foyer CLI..."
if command -v foyer &>/dev/null; then
  echo "  foyer 已安装，跳过"
else
  npm install -g foyer-cli
fi

echo ""
echo "✓ 完成。运行以下命令查看已有项目："
echo "  foyer repo list"
