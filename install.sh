#!/bin/bash

# Pi Coding Agent - Auto Setup Script
# 自动化配置 pi coding agent 的插件和 MCP 服务器

set -e

# ============================================
# 颜色定义
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================
# 辅助函数
# ============================================
print_header() {
    local title="$1"
    
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}  ${BLUE}${title}${NC}                                              ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}▸${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# 读取用户输入（支持默认值）
prompt_input() {
    local prompt="$1"
    local default="$2"
    local result
    
    if [ -n "$default" ]; then
        read -p "$(echo -e "${CYAN}?${NC} ${prompt} [${default}]: ")" result
        echo "${result:-$default}"
    else
        read -p "$(echo -e "${CYAN}?${NC} ${prompt}: ")" result
        echo "$result"
    fi
}

# 读取敏感输入（隐藏输入）
prompt_secret() {
    local prompt="$1"
    local result
    
    read -s -p "$(echo -e "${CYAN}?${NC} ${prompt}: ")" result
    echo ""
    echo "$result"
}

# 确认提示
confirm() {
    local prompt="$1"
    local default="${2:-y}"
    local result
    
    read -p "$(echo -e "${CYAN}?${NC} ${prompt} [${default}]: ")" result
    result="${result:-$default}"
    [[ "$result" =~ ^[Yy]$ ]]
}

# ============================================
# 检查依赖
# ============================================
check_dependencies() {
    print_header "检查依赖"
    
    # 检查 pi CLI
    if ! command -v pi &> /dev/null; then
        print_error "未找到 pi CLI"
        echo "请先安装 pi: npm install -g @anthropic-ai/pi-coding-agent"
        exit 1
    fi
    print_success "pi CLI 已安装: $(pi --version 2>/dev/null || echo 'unknown')"
    
    # 检查 node/npm
    if ! command -v node &> /dev/null; then
        print_error "未找到 Node.js"
        echo "请先安装 Node.js: https://nodejs.org/"
        exit 1
    fi
    print_success "Node.js 已安装: $(node --version)"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "未找到 npm"
        echo "请先安装 npm"
        exit 1
    fi
    print_success "npm 已安装: $(npm --version)"
}

# ============================================
# 安装 RTK (Rust Token Killer)
# ============================================
install_rtk() {
    print_header "安装 RTK (Rust Token Killer)"
    
    print_info "RTK 是一个高性能 CLI 代理，可减少 LLM token 消耗 60-90%"
    print_info "通过过滤和压缩命令输出来实现这一点"
    echo ""
    
    # 检查 RTK 是否已安装
    if command -v rtk &> /dev/null; then
        local rtk_version=$(rtk --version 2>/dev/null || echo "unknown")
        print_success "RTK 已安装: ${rtk_version}"
        
        # 检查是否已初始化
        if [ -f "~/.rtk/config.toml" ] || [ -f ".rtk/config.toml" ]; then
            print_success "RTK 已初始化"
        else
            print_step "初始化 RTK for Pi..."
            rtk init -g --agent pi 2>/dev/null || print_warning "RTK 初始化失败"
        fi
        return
    fi
    
    # 检测操作系统
    local os_type=$(uname -s)
    local arch_type=$(uname -m)
    
    print_step "检测到系统: ${os_type} ${arch_type}"
    
    # 尝试使用 Homebrew 安装 (macOS)
    if [ "$os_type" = "Darwin" ] && command -v brew &> /dev/null; then
        print_step "使用 Homebrew 安装 RTK..."
        if brew install rtk; then
            print_success "RTK 安装成功"
        else
            print_warning "Homebrew 安装失败，尝试其他方法..."
        fi
    fi
    
    # 如果 Homebrew 未安装或失败，使用安装脚本
    if ! command -v rtk &> /dev/null; then
        print_step "使用安装脚本安装 RTK..."
        if curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh; then
            print_success "RTK 安装成功"
            # 添加到 PATH
            export PATH="$HOME/.local/bin:$PATH"
        else
            print_error "RTK 安装失败"
            print_info "请手动安装: https://github.com/rtk-ai/rtk"
            return
        fi
    fi
    
    # 初始化 RTK for Pi
    if command -v rtk &> /dev/null; then
        print_step "初始化 RTK for Pi..."
        if rtk init -g --agent pi; then
            print_success "RTK 已初始化"
        else
            print_warning "RTK 初始化失败，请手动运行: rtk init -g --agent pi"
        fi
        
        # 验证安装
        echo ""
        print_step "验证 RTK 安装..."
        rtk --version
        rtk gain 2>/dev/null || true
    fi
}

# ============================================
# 安装 AgentMemory
# ============================================
install_agentmemory() {
    print_header "安装 AgentMemory 扩展"

    print_info "跨会话持久化记忆，与 Claude Code / Codex CLI 共享"
    print_info "https://github.com/rohitg00/agentmemory/tree/main/integrations/pi"
    echo ""

    local ext_dir="$HOME/.pi/agent/extensions/agentmemory"

    # 1. 复制 pi 扩展文件
    if [ -f "$ext_dir/index.ts" ]; then
        print_success "pi 扩展文件已存在"
    else
        print_step "从 GitHub 获取 pi 扩展文件..."
        local tmp_dir=$(mktemp -d)
        if git clone --depth 1 https://github.com/rohitg00/agentmemory.git "$tmp_dir" 2>/dev/null; then
            if [ -f "$tmp_dir/integrations/pi/index.ts" ]; then
                mkdir -p "$ext_dir"
                cp "$tmp_dir/integrations/pi/index.ts" "$ext_dir/index.ts"
                print_success "pi 扩展文件已复制"
            else
                print_warning "GitHub 仓库中未找到 pi 集成文件"
            fi
            rm -rf "$tmp_dir"
        else
            print_warning "无法克隆仓库，请手动安装"
            print_info "手动步骤: https://github.com/rohitg00/agentmemory/tree/main/integrations/pi"
            return
        fi
    fi

    # 2. 确保 settings.json 注册了扩展
    local settings_file="$HOME/.pi/agent/settings.json"
    if [ -f "$settings_file" ] && command -v python3 &> /dev/null; then
        local has_ext=$(python3 -c "
import json
with open('$settings_file') as f:
    data = json.load(f)
exts = data.get('extensions', [])
print('yes' if '$ext_dir' in exts else 'no')
" 2>/dev/null)
        if [ "$has_ext" != "yes" ]; then
            print_step "注册到 settings.json..."
            python3 -c "
import json
with open('$settings_file') as f:
    data = json.load(f)
exts = data.get('extensions', [])
if '$ext_dir' not in exts:
    exts.append('$ext_dir')
    data['extensions'] = exts
    with open('$settings_file', 'w') as f:
        json.dump(data, f, indent=2)
" 2>/dev/null
            print_success "已注册"
        else
            print_success "已在 settings.json 中注册"
        fi
    fi

    echo ""
    print_success "AgentMemory 扩展安装完成"
    print_info "启动服务: npx @agentmemory/agentmemory"
    print_info "验证:     /agentmemory-status"
}

# ============================================
# 安装 cost-budget 扩展（成本节约）
# ============================================
install_cost_budget() {
    print_header "安装 cost-budget 扩展"

    print_info "借鉴 OpenSquilla 的成本节约方案，包含："
    print_info "  • 上下文预算分类（EXTERNAL/LOCAL/ARTIFACT）"
    print_info "  • 工具输出配额执行（自动裁剪超大结果）"
    print_info "  • 智能路由拒绝门控（复杂任务检测）"
    print_info "  • 会话成本追踪（/cost 命令）"
    print_info "  • 任务复杂度分类（c0-c3 四级）"
    echo ""

    local src_dir=".pi/extensions/cost-budget"
    local global_dir="$HOME/.pi/agent/extensions/cost-budget"

    # 检查源目录是否存在
    if [ ! -d "$src_dir" ]; then
        print_warning "未找到 $src_dir，跳过 cost-budget 安装"
        return
    fi

    # 检查是否已安装到全局目录
    local src_abs="$HOME/pi-dotfiles/$src_dir"
    if [ -L "$global_dir" ]; then
        local current_target=$(readlink "$global_dir")
        if [ "$current_target" = "$src_abs" ]; then
            print_success "cost-budget 软链接已存在"
        else
            print_step "更新 cost-budget 软链接..."
            ln -sfn "$src_abs" "$global_dir"
            print_success "cost-budget 软链接已更新"
        fi
    elif [ -d "$global_dir" ]; then
        print_step "移除旧的 cost-budget 目录，改用软链接..."
        rm -rf "$global_dir"
        ln -sfn "$src_abs" "$global_dir"
        print_success "cost-budget 已改为软链接"
    else
        print_step "创建 cost-budget 软链接..."
        ln -sfn "$src_abs" "$global_dir"
        print_success "cost-budget 软链接已创建"
    fi

    # 注册到 settings.json
    local settings_file="$HOME/.pi/agent/settings.json"
    if [ -f "$settings_file" ] && command -v python3 &> /dev/null; then
        local has_ext=$(python3 -c "
import json
with open('$settings_file') as f:
    data = json.load(f)
exts = data.get('extensions', [])
print('yes' if '$global_dir' in exts else 'no')
" 2>/dev/null)
        if [ "$has_ext" != "yes" ]; then
            print_step "在 settings.json 中注册 cost-budget 扩展..."
            python3 -c "
import json
with open('$settings_file') as f:
    data = json.load(f)
exts = data.get('extensions', [])
if '$global_dir' not in exts:
    exts.append('$global_dir')
    data['extensions'] = exts
    with open('$settings_file', 'w') as f:
        json.dump(data, f, indent=2)
    print('done')
" 2>/dev/null
            print_success "cost-budget 扩展已注册"
        else
            print_success "cost-budget 扩展已在 settings.json 中注册"
        fi
    fi

    echo ""
    print_success "cost-budget 安装完成"
    print_info "命令: /budget  /cost  /cost-report  /complexity"
}

# ============================================
# 安装 pi-mempalace-extension（MemPalace 自动集成）
# ============================================
install_pi_mempalace_extension() {
    print_header "安装 pi-dream 扩展"

    print_info "MemPalace 自动集成扩展，替代原 pi-dream："
    print_info "  • session 启动自动注入 wake-up context"
    print_info "  • 每 15 条消息自动提醒保存记忆"
    print_info "  • 压缩前自动挖掘 session 内容"
    print_info "  • 提供 mempalace_search/status/mine/wake_up/doctor 工具"
    echo ""

    # 通过 pi install 安装 npm 包
    if command -v pi &> /dev/null; then
        print_step "通过 pi install 安装 pi-mempalace-extension..."
        pi install npm:pi-mempalace-extension 2>/dev/null
        print_success "pi-mempalace-extension 已安装"
    else
        print_warning "pi 命令不可用，跳过 npm 安装"
        print_info "手动安装: pi install npm:pi-mempalace-extension"
    fi

    # 检查 mempalace CLI
    if command -v mempalace &> /dev/null; then
        local version=$(mempalace --version 2>/dev/null)
        print_success "mempalace CLI 已安装: $version"
    else
        print_warning "mempalace CLI 未安装"
        print_info "安装: uv tool install mempalace 或 pip install mempalace"
    fi

    # 清理旧的 pi-dream 扩展（如果存在）
    local old_dream="$HOME/.pi/agent/extensions/pi-dream"
    if [ -d "$old_dream" ] || [ -L "$old_dream" ]; then
        print_step "移除旧的 pi-dream 扩展..."
        rm -rf "$old_dream"
        local settings_file="$HOME/.pi/agent/settings.json"
        if [ -f "$settings_file" ] && command -v python3 &> /dev/null; then
            python3 -c "
import json
with open('$settings_file') as f:
    data = json.load(f)
exts = data.get('extensions', [])
new_exts = [e for e in exts if 'pi-dream' not in e]
data['extensions'] = new_exts
with open('$settings_file', 'w') as f:
    json.dump(data, f, indent=2)
" 2>/dev/null
        fi
        print_success "旧 pi-dream 已清理"
    fi

    echo ""
    print_success "pi-mempalace-extension 安装完成"
    print_info "重启 pi session 后自动生效"
}

# ============================================
# 安装自定义 Agents & Skills
# ============================================
install_agents() {
    print_header "安装自定义 Agents & Skills"

    # --- Agents ---
    print_step "安装 Agents..."
    local agent_src=".pi/agent/agents"
    local agent_dst="$HOME/.pi/agent/agents"

    if [ -d "$agent_src" ] && [ -n "$(ls -A "$agent_src"/*.md 2>/dev/null)" ]; then
        mkdir -p "$agent_dst"
        local count=0
        for f in "$agent_src"/*.md; do
            [ -f "$f" ] || continue
            local name=$(basename "$f")
            if [ -f "$agent_dst/$name" ] && diff -q "$f" "$agent_dst/$name" > /dev/null 2>&1; then
                print_success "agent:${name%.md} 已是最新"
            else
                cp "$f" "$agent_dst/$name"
                print_success "agent:${name%.md} 已安装"
            fi
            count=$((count + 1))
        done
        print_info "共 ${count} 个 agents"
    else
        print_warning "未找到 agent 定义文件，跳过"
    fi

    echo ""
    print_info "Agents 会在下次启动 pi 时自动加载"
    print_info "Skills 由 p-skills 独立管理（~/.p-skills/skills/）"
    echo ""
}

# ============================================
# 安装社区扩展
# ============================================
install_extensions() {
    print_header "安装社区扩展"
    
    local extensions=(
        # 已本地修改的扩展，不从社区安装（会覆盖本地改动）：
        # - pi-mcp-adapter
        # - pi-subagents
        # - pi-web-access
        # - pi-rtk-optimizer
        #
        # 以下扩展可安全从社区安装：
        "context-mode"
        "@spences10/pi-lsp"
        "@vndv/pi-codegraph"
    )
    
    # 获取已安装的扩展列表
    # 直接从 settings.json 读取，避免 pi list 加载本地扩展的 node_modules（很慢）
    local installed_list=""
    if [ -f "$HOME/.pi/agent/settings.json" ] && command -v python3 &> /dev/null; then
        installed_list=$(python3 -c "
import json
try:
    with open('$HOME/.pi/agent/settings.json') as f:
        data = json.load(f)
    for pkg in data.get('packages', []):
        print(pkg)
except:
    pass
" 2>/dev/null)
    fi
    # 备用：如果 python 失败，用 timeout 限制 pi list
    if [ -z "$installed_list" ]; then
        installed_list=$(timeout 10 pi list 2>/dev/null || true)
    fi

    for ext in "${extensions[@]}"; do
        # 检查扩展是否已安装
        if echo "$installed_list" | grep -q "$ext"; then
            print_success "${ext} 已安装，跳过"
        else
            print_step "安装 ${ext}..."
            # 超时 60 秒，避免卡住
            if timeout 60 pi install "npm:${ext}" 2>&1 | tail -5; then
                print_success "${ext} 安装成功"
            else
                local exit_code=$?
                if [ $exit_code -eq 124 ]; then
                    print_warning "${ext} 安装超时（60s）"
                else
                    print_warning "${ext} 安装失败（exit: ${exit_code}）"
                fi
            fi
        fi
    done
    
    # 清理旧的 rtk.ts 扩展（pi-rtk-optimizer 是它的超集，会冲突）
    local old_rtk_ext="$HOME/.pi/agent/extensions/rtk.ts"
    if [ -f "$old_rtk_ext" ]; then
        rm -f "$old_rtk_ext"
        print_step "已移除旧的 rtk.ts 扩展（已被 pi-rtk-optimizer 替代）"
    fi
    
    echo ""
    print_success "社区扩展检查完成"
}

# ============================================
# 读取现有 API Key
# ============================================
get_existing_api_key() {
    local key_name="$1"
    local config_file=".pi/web-search.json"
    
    # 1. 检查 .pi/web-search.json
    if [ -f "$config_file" ]; then
        local result=""
        if command -v python3 &> /dev/null; then
            result=$(python3 -c "
import json
try:
    with open('$config_file') as f:
        data = json.load(f)
    print(data.get('$key_name', ''))
except:
    pass
" 2>/dev/null)
        elif command -v jq &> /dev/null; then
            result=$(jq -r ".${key_name} // empty" "$config_file" 2>/dev/null)
        fi
        if [ -n "$result" ]; then
            echo "$result"
            return
        fi
    fi
    
    # 2. 检查 .mcp.json 或 ~/.pi/agent/mcp.json 中的 Context7 key
    if [ "$key_name" = "context7ApiKey" ]; then
        for mcp_file in ".mcp.json" "$HOME/.pi/agent/mcp.json"; do
            if [ -f "$mcp_file" ]; then
                local result=""
                if command -v python3 &> /dev/null; then
                    result=$(python3 -c "
import json
try:
    with open('$mcp_file') as f:
        data = json.load(f)
    ctx7 = data.get('mcpServers', {}).get('context7', {})
    headers = ctx7.get('headers', {})
    print(headers.get('CONTEXT7_API_KEY', ''))
except:
    pass
" 2>/dev/null)
                elif command -v jq &> /dev/null; then
                    result=$(jq -r '.mcpServers.context7.headers.CONTEXT7_API_KEY // empty' "$mcp_file" 2>/dev/null)
                fi
                if [ -n "$result" ]; then
                    echo "$result"
                    return
                fi
            fi
        done
    fi
    
    # 3. 检查环境变量
    case "$key_name" in
        context7ApiKey) [ -n "$CONTEXT7_API_KEY" ] && echo "$CONTEXT7_API_KEY" && return ;;
        githubToken) [ -n "$GITHUB_TOKEN" ] && echo "$GITHUB_TOKEN" && return ;;
    esac
}


# 检查并提示已存在的 API Key
prompt_api_key_with_existing() {
    local label="$1"
    local key_name="$2"
    local description="$3"
    local get_url="$4"
    local skip_all_var="$5"
    
    echo -e "${BLUE}━━━ ${label} ━━━${NC}" >&2
    print_info "${description} 获取: ${get_url}" >&2
    
    # 读取现有 key
    local existing_key=$(get_existing_api_key "$key_name")
    
    if [ -n "$existing_key" ]; then
        # 隐藏显示 key（只显示前4位和后4位）
        local masked_key="${existing_key:0:4}****${existing_key: -4}"
        print_success "已配置: ${masked_key}" >&2
        if confirm "是否替换现有 API Key？" "n"; then
            local new_key=$(prompt_input "${label} API Key" "")
            if [ "$new_key" = "s" ] || [ "$new_key" = "S" ]; then
                eval "$skip_all_var=true"
                echo ""
                return ""
            fi
            echo "$new_key"
        else
            # 用户选择保留现有 key
            echo "$existing_key"
        fi
    else
        # 没有现有 key
        local new_key=$(prompt_input "${label} API Key (回车跳过)" "")
        if [ "$new_key" = "s" ] || [ "$new_key" = "S" ]; then
            eval "$skip_all_var=true"
            echo ""
            return ""
        fi
        echo "$new_key"
    fi
}

# ============================================
# 配置 API Keys
# ============================================
configure_api_keys() {
    print_header "配置 API Keys"
    
    print_info "以下 API Keys 用于增强功能。"
    print_info "• 直接回车跳过单个 API Key"
    print_info "• 输入 s 跳过所有 API Key 配置"
    print_info "• 已配置的 Key 会显示掩码，可选择保留或替换"
    echo ""
    
    local skip_all=false
    
    # Context7 API Key
    CONTEXT7_API_KEY=$(prompt_api_key_with_existing "Context7" "context7ApiKey" "用于获取最新库文档。" "https://context7.com/dashboard" "skip_all")
    
    # Exa API Key
    if [ "$skip_all" = false ]; then
        EXA_API_KEY=$(prompt_api_key_with_existing "Exa Search" "exaApiKey" "用于网页搜索。" "https://exa.ai" "skip_all")
    fi
    
    # Perplexity API Key
    if [ "$skip_all" = false ]; then
        PERPLEXITY_API_KEY=$(prompt_api_key_with_existing "Perplexity" "perplexityApiKey" "备用搜索引擎。" "https://perplexity.ai" "skip_all")
    fi
    
    # Gemini API Key
    if [ "$skip_all" = false ]; then
        GEMINI_API_KEY=$(prompt_api_key_with_existing "Gemini" "geminiApiKey" "用于视频理解和备用搜索。" "https://makersuite.google.com/app/apikey" "skip_all")
    fi
    
    # GitHub Token
    if [ "$skip_all" = false ]; then
        echo -e "${BLUE}━━━ GitHub ━━━${NC}"
        print_info "用于访问私有仓库。获取: https://github.com/settings/tokens"
        
        local existing_github=$(get_existing_api_key "githubToken")
        
        if [ -n "$existing_github" ]; then
            local masked_token="${existing_github:0:4}****${existing_github: -4}"
            print_success "已配置: ${masked_token}"
            if confirm "是否替换现有 GitHub Token？" "n"; then
                GITHUB_TOKEN=$(prompt_input "GitHub Token" "")
                if [ "$GITHUB_TOKEN" = "s" ] || [ "$GITHUB_TOKEN" = "S" ]; then
                    skip_all=true
                    GITHUB_TOKEN=""
                fi
            else
                GITHUB_TOKEN="$existing_github"
            fi
        else
            GITHUB_TOKEN=$(prompt_input "GitHub Token (回车跳过)" "")
            if [ "$GITHUB_TOKEN" = "s" ] || [ "$GITHUB_TOKEN" = "S" ]; then
                skip_all=true
                GITHUB_TOKEN=""
            fi
        fi
        echo ""
    fi
    
    if [ "$skip_all" = true ]; then
        print_info "已跳过所有 API Key 配置"
    fi
}

# ============================================
# 生成配置文件
# ============================================
generate_configs() {
    print_header "生成配置文件"
    
    # 创建目录（如果不存在）
    mkdir -p .pi
    mkdir -p ~/.pi/agent
    
    # ─────────────────────────────────────────
    # 生成 .mcp.json（MCP 服务器配置）
    # ─────────────────────────────────────────
    print_step "生成 .mcp.json..."
    
    # 检查 uv 是否可用（Semble 需要）
    local uv_available=false
    if command -v uv &> /dev/null; then
        uv_available=true
    fi
    
    # 构建 MCP 配置
    local mcp_config='{\n  "mcpServers": {\n'
    
    # Context7
    mcp_config+='    "context7": {\n'
    if [ -n "$CONTEXT7_API_KEY" ]; then
        mcp_config+='      "url": "https://mcp.context7.com/mcp",\n'
        mcp_config+='      "headers": {\n'
        mcp_config+='        "CONTEXT7_API_KEY": "'"${CONTEXT7_API_KEY}"'"\n'
        mcp_config+='      },\n'
    else
        mcp_config+='      "url": "https://mcp.context7.com/mcp",\n'
    fi
    mcp_config+='      "lifecycle": "lazy"\n    },\n'
    
    # Playwright MCP
    mcp_config+='    "playwright": {\n'
    mcp_config+='      "command": "npx",\n'
    mcp_config+='      "args": ["@playwright/mcp@latest"],\n'
    mcp_config+='      "lifecycle": "lazy"\n    },\n'
    
    # Semble MCP (需要 uv)
    mcp_config+='    "semble": {\n'
    mcp_config+='      "command": "uvx",\n'
    mcp_config+='      "args": ["--from", "semble[mcp]", "semble"],\n'
    mcp_config+='      "lifecycle": "lazy"\n    }\n'
    if [ "$uv_available" != true ]; then
        print_warning "Semble MCP 需要 uv，但未检测到 uv 安装"
        print_info "如需使用 Semble，请先安装 uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
    fi
    
    mcp_config+='  }\n}'
    
    # 写入配置文件
    echo -e "$mcp_config" > .mcp.json
    mkdir -p ~/.pi/agent
    echo -e "$mcp_config" > ~/.pi/agent/mcp.json
    print_success ".mcp.json 已生成"
    
    # ─────────────────────────────────────────
    # 生成 .pi/web-search.json
    # ─────────────────────────────────────────
    print_step "生成 .pi/web-search.json..."
    
    local web_search_config='{'
    local has_config=false
    
    if [ -n "$EXA_API_KEY" ]; then
        web_search_config+='
  "exaApiKey": "'"${EXA_API_KEY}"'",'
        has_config=true
    fi
    
    if [ -n "$PERPLEXITY_API_KEY" ]; then
        web_search_config+='
  "perplexityApiKey": "'"${PERPLEXITY_API_KEY}"'",'
        has_config=true
    fi
    
    if [ -n "$GEMINI_API_KEY" ]; then
        web_search_config+='
  "geminiApiKey": "'"${GEMINI_API_KEY}"'",'
        has_config=true
    fi
    
    # 添加默认设置
    web_search_config+='
  "workflow": "summary-review",
  "githubClone": {
    "enabled": true,
    "maxRepoSizeMB": 350
  },
  "youtube": {
    "enabled": true
  },
  "video": {
    "enabled": true,
    "maxSizeMB": 50
  }
}'
    
    echo "$web_search_config" > .pi/web-search.json
    print_success ".pi/web-search.json 已生成"
    
    # ─────────────────────────────────────────
    # 生成 .gitignore（如果不存在）
    # ─────────────────────────────────────────
    if [ ! -f .gitignore ]; then
        print_step "生成 .gitignore..."
        cat > .gitignore << 'EOF'
# === Pi runtime secrets & auth ===
.pi/agent/auth.json
.pi/agent/mcp.json
.agents/.skill-lock.json

# === Pi caches & runtime state ===
.pi/agent/mcp-cache.json
.pi/agent/magic-context/
.pi/memory/
.pi/agent/memory/
.pi/agent/sessions/
.pi/**/*.log

# === OS / Editor ===
.DS_Store
*.swp
*.swo
*~
.vscode/
.idea/

# === Node modules ===
node_modules/

# === Pi extensions build artifacts ===
.pi/agent/extensions/node_modules/

# === Pi runtime state ===
.pi/agent/run-history.jsonl
.pi/agent/tasks/.current-task
.pi/agent/tasks/pending/
.pi/exa-usage.json
.pi/agent/patch-extension-display.sh
.pi/**/*.backup.*

# === Pi tasks runtime ===
.pi/tasks/
EOF
        print_success ".gitignore 已生成"
    fi
}

# ============================================
# 验证安装
# ============================================
verify_installation() {
    print_header "验证安装"
    
    # 检查扩展（直接从 settings.json 读取，避免 pi list 加载本地扩展的 node_modules）
    print_step "检查已安装的扩展..."
    if [ -f "$HOME/.pi/agent/settings.json" ] && command -v python3 &> /dev/null; then
        python3 -c "
import json
try:
    with open('$HOME/.pi/agent/settings.json') as f:
        data = json.load(f)
    packages = data.get('packages', [])
    print(f'已安装 {len(packages)} 个包:')
    for pkg in packages:
        print(f'  • {pkg}')
except Exception as e:
    print(f'读取失败: {e}')
" 2>/dev/null
    else
        timeout 5 pi list 2>/dev/null || true
    fi
    echo ""
    
    # 检查配置文件
    print_step "检查配置文件..."
    
    if [ -f ~/.pi/agent/mcp.json ]; then
        print_success "~/.pi/agent/mcp.json 存在"
    else
        print_error "~/.pi/agent/mcp.json 不存在"
    fi
    
    if [ -f .pi/web-search.json ]; then
        print_success ".pi/web-search.json 存在"
    else
        print_error ".pi/web-search.json 不存在"
    fi

    # 检查 agents
    print_step "检查自定义 Agents..."
    local agent_dir="$HOME/.pi/agent/agents"
    if [ -d "$agent_dir" ]; then
        local agent_count=$(ls -1 "$agent_dir"/*.md 2>/dev/null | wc -l)
        if [ $agent_count -gt 0 ]; then
            print_success "已安装 ${agent_count} 个 agents"
            for f in "$agent_dir"/*.md; do
                [ -f "$f" ] || continue
                local name=$(grep -m1 "^name:" "$f" 2>/dev/null | sed 's/name: *//')
                print_info "  • ${name:-$(basename "$f" .md)}"
            done
        else
            print_warning "agents 目录为空"
        fi
    else
        print_warning "agents 目录不存在"
    fi

    # Skills 由 p-skills 独立管理
    print_step "检查 Skills..."
    if [ -d "$HOME/.p-skills/skills" ]; then
        local skill_count=$(ls -1d "$HOME/.p-skills/skills"/*/ 2>/dev/null | wc -l)
        print_success "p-skills 仓库: ${skill_count} 个 skills"
    fi
}

# ============================================
# 可选依赖安装
# ============================================
install_optional_deps() {
    print_header "可选依赖"
    
    print_info "以下依赖用于视频处理功能（YouTube/本地视频分析）"
    echo ""
    
    # ffmpeg
    if command -v ffmpeg &> /dev/null; then
        print_success "ffmpeg 已安装"
    else
        if confirm "是否安装 ffmpeg？(用于视频帧提取)" "n"; then
            if command -v brew &> /dev/null; then
                print_step "使用 Homebrew 安装 ffmpeg..."
                brew install ffmpeg
            else
                print_warning "未找到 Homebrew，请手动安装 ffmpeg"
            fi
        fi
    fi
    
    # yt-dlp
    if command -v yt-dlp &> /dev/null; then
        print_success "yt-dlp 已安装"
    else
        if confirm "是否安装 yt-dlp？(用于 YouTube 视频)" "n"; then
            if command -v brew &> /dev/null; then
                print_step "使用 Homebrew 安装 yt-dlp..."
                brew install yt-dlp
            else
                print_warning "未找到 Homebrew，请手动安装 yt-dlp"
            fi
        fi
    fi
    
    # uv (Python package manager, needed for Semble)
    if command -v uv &> /dev/null; then
        print_success "uv 已安装"
    else
        if confirm "是否安装 uv？(Semble MCP 需要)" "n"; then
            print_step "安装 uv..."
            curl -LsSf https://astral.sh/uv/install.sh | sh
            if [ $? -eq 0 ]; then
                print_success "uv 安装成功"
            else
                print_warning "uv 安装失败，请手动安装"
            fi
        fi
    fi
}

# ============================================
# 显示完成信息
# ============================================
show_completion() {
    print_header "配置完成！"
    
    echo -e "${GREEN}已安装的工具：${NC}"
    echo "  • RTK           - Rust Token Killer (减少 token 消耗 60-90%)"
    echo ""
    
    echo -e "${GREEN}已安装的扩展：${NC}"
    echo "  • agentmemory       - 持久化跨会话记忆"
    echo "  • @vndv/pi-codegraph - CodeGraph 代码知识图谱"
    echo "  • cost-budget       - 成本节约（预算分类/配额/拒绝门控/成本追踪）"
    echo "  • pi-mcp-adapter    - MCP 协议适配器"
    echo "  • context-mode      - 上下文模式管理"
    echo "  • pi-subagents      - 子 agent 协作"
    echo "  • pi-web-access     - Web 搜索和内容提取"
    echo "  • @spences10/pi-lsp - LSP 语言服务器支持"
    echo ""
    
    echo -e "${GREEN}已配置的 MCP 服务器：${NC}"
    echo "  • Context7      - 获取最新库文档"
    echo "  • Playwright    - 浏览器自动化"
    if command -v uv &> /dev/null; then
        echo "  • Semble        - 语义代码搜索"
    fi
    echo ""
    
    echo -e "${GREEN}配置文件：${NC}"
    echo "  • ~/.pi/agent/mcp.json   - MCP 服务器配置（全局）"
    echo "  • .mcp.json              - MCP 服务器配置（项目）"
    echo "  • .pi/web-search.json    - Web 搜索配置"
    echo "  • .gitignore             - Git 忽略规则"
    echo ""
    
    echo -e "${YELLOW}下一步：${NC}"
    echo "  1. 重启 pi 会话以加载新配置"
    echo "  2. 运行 pi 启动新会话"
    echo ""
    
    if [ -z "$CONTEXT7_API_KEY" ]; then
        print_warning "未配置 Context7 API Key，建议配置以获取更高频率限制"
        echo "  获取地址: https://context7.com/dashboard"
    fi
    
    echo -e "${BLUE}MCP 工具使用示例：${NC}"
    echo "  mcp({ search: 'React hooks' })           # Context7 文档搜索"
    echo "  mcp({ tool: 'playwright_navigate', ... }) # 浏览器自动化"
    if command -v uv &> /dev/null; then
        echo "  mcp({ search: 'database connection' })   # Semble 语义搜索"
    fi
    echo ""
    echo -e "${BLUE}扩展工具使用示例：${NC}"
    echo "  codegraph_context '任务描述'               # CodeGraph 代码上下文"
    echo "  codegraph_search 'symbol_name'             # 搜索符号"
    echo "  /agentmemory-status                        # 检查记忆服务"
    echo ""
    
    if command -v rtk &> /dev/null; then
        echo -e "${BLUE}RTK 使用示例：${NC}"
        echo "  rtk git status                         # 压缩 git 状态"
        echo "  rtk git diff                           # 压缩 diff 输出"
        echo "  rtk ls .                               # 优化目录列表"
        echo "  rtk read file.rs                       # 智能文件读取"
        echo "  rtk grep 'pattern' .                   # 分组搜索结果"
        echo "  rtk cargo test                         # 压缩测试输出"
        echo ""
    fi
}

# ============================================
# 主流程
# ============================================
main() {
    clear
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}                                                          ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  ${BLUE}🚀 Pi Coding Agent - Auto Setup${NC}                        ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}                                                          ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}  自动化配置插件、MCP 服务器和 API Keys               ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}                                                          ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # 检查是否在正确的目录
    if [ ! -d ".pi" ]; then
        print_warning "当前目录没有 .pi 目录"
        if confirm "是否创建 .pi 目录并继续？"; then
            mkdir -p .pi
        else
            print_error "请在 pi 项目目录中运行此脚本"
            exit 1
        fi
    fi
    
    # 执行安装步骤
    check_dependencies
    install_agents
    install_rtk
    install_agentmemory
    install_extensions
    install_cost_budget
    install_pi_mempalace_extension
    configure_api_keys
    generate_configs
    install_optional_deps
    verify_installation
    show_completion
}

# 运行主流程
main "$@"
