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
    print_header "安装 AgentMemory"
    
    print_info "AgentMemory 为编码代理提供持久化跨会话记忆"
    print_info "https://github.com/rohitg00/agentmemory"
    echo ""
    
    # 1. 全局安装 agentmemory
    if command -v agentmemory &> /dev/null; then
        local am_version=$(agentmemory --version 2>/dev/null || echo "unknown")
        print_success "agentmemory 已安装: v${am_version}"
    else
        print_step "全局安装 @agentmemory/agentmemory..."
        if npm install -g @agentmemory/agentmemory; then
            print_success "agentmemory 安装成功"
        else
            print_error "agentmemory 安装失败"
            print_info "请手动运行: npm install -g @agentmemory/agentmemory"
            return
        fi
    fi
    
    # 2. 复制 pi 扩展文件
    local ext_dir="$HOME/.pi/agent/extensions/agentmemory"
    local am_pkg=$(npm root -g)/@agentmemory/agentmemory
    local repo_integrations="${am_pkg}/integrations/pi"
    
    # 优先从 npm 包复制，如果没有则从 GitHub 克隆
    if [ -d "$repo_integrations" ] && [ -f "$repo_integrations/index.ts" ]; then
        print_step "从 npm 包复制 pi 扩展文件..."
        mkdir -p "$ext_dir"
        cp "$repo_integrations/index.ts" "$ext_dir/index.ts"
        cp "$repo_integrations/security.ts" "$ext_dir/security.ts"
        print_success "pi 扩展文件已复制到 $ext_dir"
    else
        print_step "npm 包中无 integrations/pi，从 GitHub 获取..."
        local tmp_dir=$(mktemp -d)
        if git clone --depth 1 https://github.com/rohitg00/agentmemory.git "$tmp_dir" 2>/dev/null; then
            if [ -f "$tmp_dir/integrations/pi/index.ts" ]; then
                mkdir -p "$ext_dir"
                cp "$tmp_dir/integrations/pi/index.ts" "$ext_dir/index.ts"
                cp "$tmp_dir/integrations/pi/security.ts" "$ext_dir/security.ts"
                print_success "pi 扩展文件已复制到 $ext_dir"
            else
                print_warning "GitHub 仓库中未找到 pi 集成文件"
            fi
            rm -rf "$tmp_dir"
        else
            print_warning "无法克隆 agentmemory 仓库，请手动安装"
            print_info "手动步骤: https://github.com/rohitg00/agentmemory/tree/main/integrations/pi"
        fi
    fi
    
    # 3. 确保 settings.json 注册了扩展
    local settings_file="$HOME/.pi/agent/settings.json"
    if [ -f "$settings_file" ]; then
        if command -v python3 &> /dev/null; then
            local has_ext=$(python3 -c "
import json
with open('$settings_file') as f:
    data = json.load(f)
exts = data.get('extensions', [])
print('yes' if '$ext_dir' in exts else 'no')
" 2>/dev/null)
            if [ "$has_ext" != "yes" ]; then
                print_step "在 settings.json 中注册 agentmemory 扩展..."
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
    print('done')
" 2>/dev/null
                print_success "agentmemory 扩展已注册"
            else
                print_success "agentmemory 扩展已在 settings.json 中注册"
            fi
        fi
    else
        print_step "创建 settings.json..."
        mkdir -p "$HOME/.pi/agent"
        cat > "$settings_file" << EOSETTINGS
{
  "extensions": [
    "$ext_dir"
  ]
}
EOSETTINGS
        print_success "settings.json 已创建"
    fi
    
    echo ""
    print_success "AgentMemory 安装完成"
    print_info "启动服务器: agentmemory"
    print_info "查看状态: http://localhost:3113"
    print_info "健康检查: curl http://localhost:3111/agentmemory/health"
}

# ============================================
# 安装社区扩展
# ============================================
install_extensions() {
    print_header "安装社区扩展"
    
    local extensions=(
        "pi-mcp-adapter"
        "context-mode"
        "pi-subagents"
        "pi-web-access"
        "@spences10/pi-lsp"
        "pi-rtk-optimizer"
    )
    
    # 获取已安装的扩展列表
    local installed_list=$(pi list 2>/dev/null || true)
    
    for ext in "${extensions[@]}"; do
        # 检查扩展是否已安装
        if echo "$installed_list" | grep -q "$ext"; then
            print_success "${ext} 已安装，跳过"
        else
            print_step "安装 ${ext}..."
            if pi install "npm:${ext}" 2>/dev/null; then
                print_success "${ext} 安装成功"
            else
                print_warning "${ext} 安装失败"
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
    
    if [ -f "$config_file" ]; then
        # 使用 python 或 jq 读取 JSON（兼容性更好）
        if command -v python3 &> /dev/null; then
            python3 -c "
import json
try:
    with open('$config_file') as f:
        data = json.load(f)
    print(data.get('$key_name', ''))
except:
    pass
" 2>/dev/null
        elif command -v jq &> /dev/null; then
            jq -r ".${key_name} // empty" "$config_file" 2>/dev/null
        fi
    fi
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
    
    # CodeGraph MCP
    if command -v codegraph &> /dev/null; then
        mcp_config+='    "codegraph": {\n'
        mcp_config+='      "command": "codegraph",\n'
        mcp_config+='      "args": ["serve"],\n'
        mcp_config+='      "lifecycle": "lazy"\n    },\n'
    else
        mcp_config+='    "codegraph": {\n'
        mcp_config+='      "command": "npx",\n'
        mcp_config+='      "args": ["@colbymchenry/codegraph", "serve"],\n'
        mcp_config+='      "lifecycle": "lazy"\n    },\n'
    fi
    
    # Semble MCP (需要 uv)
    if [ "$uv_available" = true ]; then
        mcp_config+='    "semble": {\n'
        mcp_config+='      "command": "uvx",\n'
        mcp_config+='      "args": ["--from", "semble[mcp]", "semble"],\n'
        mcp_config+='      "lifecycle": "lazy"\n    },\n'
    fi
    
    # AgentMemory MCP
    if command -v agentmemory &> /dev/null; then
        mcp_config+='    "agentmemory": {\n'
        mcp_config+='      "command": "agentmemory",\n'
        mcp_config+='      "args": ["serve"],\n'
        mcp_config+='      "lifecycle": "lazy"\n    }\n'
    else
        mcp_config+='    "agentmemory": {\n'
        mcp_config+='      "command": "npx",\n'
        mcp_config+='      "args": ["@agentmemory/agentmemory", "serve"],\n'
        mcp_config+='      "lifecycle": "lazy"\n    }\n'
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
    
    # 检查扩展
    print_step "检查已安装的扩展..."
    pi list 2>/dev/null || true
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
    fi
    
    echo -e "${GREEN}已安装的扩展：${NC}"
    echo "  • agentmemory   - 持久化跨会话记忆"
    echo "  • pi-mcp-adapter    - MCP 协议适配器"
    echo "  • context-mode      - 上下文模式管理"
    echo "  • pi-subagents      - 子 agent 协作"
    echo "  • pi-web-access     - Web 搜索和内容提取"
    echo "  • @spences10/pi-lsp - LSP 语言服务器支持"
    echo ""
    
    echo -e "${GREEN}已配置的 MCP 服务器：${NC}"
    echo "  • Context7      - 获取最新库文档"
    echo "  • Playwright    - 浏览器自动化"
    echo "  • CodeGraph     - 代码知识图谱"
    if command -v uv &> /dev/null; then
        echo "  • Semble        - 语义代码搜索"
    fi
    echo "  • AgentMemory   - 持久化记忆"
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
    echo "  mcp({ search: 'auth flow' })             # CodeGraph 代码搜索"
    if command -v uv &> /dev/null; then
        echo "  mcp({ search: 'database connection' })   # Semble 语义搜索"
    fi
    echo "  mcp({ tool: 'agentmemory_recall', ... }) # 记忆检索"
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
    install_rtk
    install_agentmemory
    install_extensions
    configure_api_keys
    generate_configs
    install_optional_deps
    verify_installation
    show_completion
}

# 运行主流程
main "$@"
