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

# 安装社区插件（如果 pi 命令可用且未安装）
if command -v pi &> /dev/null; then
    install_pi_plugin() {
        local name="$1"
        if [[ ! -d "$HOME/.pi/agent/extensions/$name" ]]; then
            echo "安装 $name..."
            pi install "npm:$name"
        else
            echo "$name 已安装"
        fi
    }

    install_pi_plugin pi-lens
    install_pi_plugin pi-rtk-optimizer
    install_pi_plugin pi-mcp-adapter
    install_pi_plugin @samfp/pi-memory
    install_pi_plugin context-mode
else
    echo "⚠️  pi 命令未找到，跳过插件安装"
    echo "   安装 pi 后手动运行:"
    echo "     pi install npm:pi-lens"
    echo "     pi install npm:pi-rtk-optimizer"
    echo "     pi install npm:pi-mcp-adapter"
    echo "     pi install npm:@samfp/pi-memory"
    echo "     pi install npm:context-mode"
fi

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
