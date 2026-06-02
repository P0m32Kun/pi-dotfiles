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
    
    echo ""
    print_success "社区扩展检查完成"
}

# ============================================
# 配置 API Keys
# ============================================
configure_api_keys() {
    print_header "配置 API Keys"
    
    print_info "以下 API Keys 用于增强功能。"
    print_info "• 直接回车跳过单个 API Key"
    print_info "• 输入 s 跳过所有 API Key 配置"
    echo ""
    
    local skip_all=false
    
    # Context7 API Key
    echo -e "${BLUE}━━━ Context7 ━━━${NC}"
    print_info "用于获取最新库文档。获取: https://context7.com/dashboard"
    if [ "$skip_all" = false ]; then
        CONTEXT7_API_KEY=$(prompt_input "Context7 API Key (回车跳过)" "")
        if [ "$CONTEXT7_API_KEY" = "s" ] || [ "$CONTEXT7_API_KEY" = "S" ]; then
            skip_all=true
            CONTEXT7_API_KEY=""
        fi
    fi
    echo ""
    
    # Exa API Key
    echo -e "${BLUE}━━━ Exa Search ━━━${NC}"
    print_info "用于网页搜索。获取: https://exa.ai"
    if [ "$skip_all" = false ]; then
        EXA_API_KEY=$(prompt_input "Exa API Key (回车跳过)" "")
        if [ "$EXA_API_KEY" = "s" ] || [ "$EXA_API_KEY" = "S" ]; then
            skip_all=true
            EXA_API_KEY=""
        fi
    fi
    echo ""
    
    # Perplexity API Key
    echo -e "${BLUE}━━━ Perplexity ━━━${NC}"
    print_info "备用搜索引擎。获取: https://perplexity.ai"
    if [ "$skip_all" = false ]; then
        PERPLEXITY_API_KEY=$(prompt_input "Perplexity API Key (回车跳过)" "")
        if [ "$PERPLEXITY_API_KEY" = "s" ] || [ "$PERPLEXITY_API_KEY" = "S" ]; then
            skip_all=true
            PERPLEXITY_API_KEY=""
        fi
    fi
    echo ""
    
    # Gemini API Key
    echo -e "${BLUE}━━━ Gemini ━━━${NC}"
    print_info "用于视频理解和备用搜索。获取: https://makersuite.google.com/app/apikey"
    if [ "$skip_all" = false ]; then
        GEMINI_API_KEY=$(prompt_input "Gemini API Key (回车跳过)" "")
        if [ "$GEMINI_API_KEY" = "s" ] || [ "$GEMINI_API_KEY" = "S" ]; then
            skip_all=true
            GEMINI_API_KEY=""
        fi
    fi
    echo ""
    
    # GitHub Token
    echo -e "${BLUE}━━━ GitHub ━━━${NC}"
    print_info "用于访问私有仓库。获取: https://github.com/settings/tokens"
    if [ "$skip_all" = false ]; then
        GITHUB_TOKEN=$(prompt_input "GitHub Token (回车跳过)" "")
        if [ "$GITHUB_TOKEN" = "s" ] || [ "$GITHUB_TOKEN" = "S" ]; then
            skip_all=true
            GITHUB_TOKEN=""
        fi
    fi
    echo ""
    
    if [ "$skip_all" = true ]; then
        print_info "已跳过所有 API Key 配置"
    fi
}

# ============================================
# 生成配置文件
# ============================================
generate_configs() {
    print_header "生成配置文件"
    
    # 创建 .pi 目录（如果不存在）
    mkdir -p .pi
    mkdir -p ~/.config/mcp
    
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
    echo -e "$mcp_config" > ~/.config/mcp/mcp.json
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
    
    if [ -f .mcp.json ]; then
        print_success ".mcp.json 存在"
    else
        print_error ".mcp.json 不存在"
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
    
    echo -e "${GREEN}已安装的扩展：${NC}"
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
    echo "  • .mcp.json              - MCP 服务器配置"
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
    install_extensions
    configure_api_keys
    generate_configs
    install_optional_deps
    verify_installation
    show_completion
}

# 运行主流程
main "$@"
