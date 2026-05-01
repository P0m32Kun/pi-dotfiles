#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SUFFIX=".backup.$(date +%Y%m%d-%H%M%S)"

backup_if_exists() {
    local target="$1"
    if [[ -e "$target" ]] && [[ ! -L "$target" ]]; then
        echo "备份现有目录: $target → $target$BACKUP_SUFFIX"
        mv "$target" "$target$BACKUP_SUFFIX"
    elif [[ -L "$target" ]]; then
        echo "移除旧 symlink: $target"
        rm "$target"
    fi
}

echo "=== Pi 配置跨设备部署 ==="
echo "仓库: $REPO_DIR"
echo ""

# 备份并创建 symlink
backup_if_exists "$HOME/.pi"
backup_if_exists "$HOME/.agents"

ln -sfn "$REPO_DIR/.pi" "$HOME/.pi"
ln -sfn "$REPO_DIR/.agents" "$HOME/.agents"

echo "Symlink 已创建:"
echo "  ~/.pi    → $REPO_DIR/.pi"
echo "  ~/.agents → $REPO_DIR/.agents"
echo ""

# 检查敏感文件模板
if [[ ! -f "$HOME/.pi/agent/auth.json" ]]; then
    echo "⚠️  ~/.pi/agent/auth.json 不存在"
    echo "   运行 pi 后会自动生成，或用 1Password CLI 恢复"
fi

if [[ ! -f "$HOME/.pi/agent/mcp.json" ]]; then
    echo "⚠️  ~/.pi/agent/mcp.json 不存在"
    echo "   需要手动配置 MCP 服务器密钥"
fi

echo ""
echo "完成！运行 'pi' 验证配置是否正确加载。"
