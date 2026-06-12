# Pi Coding Agent - Dotfiles

Pi coding agent 的配置文件和自动化安装脚本。

## 快速开始

```bash
# 克隆仓库
git clone <your-repo-url> pi-dotfiles
cd pi-dotfiles

# 运行安装脚本
./install.sh
```

## 安装脚本功能

`install.sh` 会自动完成以下配置：

### 1. 安装社区扩展

| 扩展 | 用途 |
|------|------|
| `pi-mcp-adapter` | MCP 协议适配器，连接 MCP 服务器 |
| `context-mode` | 上下文模式管理 |
| `pi-subagents` | 子 agent 协作功能 |
| `pi-web-access` | Web 搜索和内容提取 |
| `@spences10/pi-lsp` | LSP 语言服务器支持 |
| `cost-budget` | 成本节约（借鉴 OpenSquilla） |

### 2. 配置 MCP 服务器

- **Context7**: 获取最新库文档
- **Playwright**: 浏览器自动化
- **CodeGraph**: 代码知识图谱
- **Semble**: 语义代码搜索（需要 uv）
- **AgentMemory**: 持久化记忆

### 3. 配置 API Keys

| API Key | 用途 | 获取地址 |
|---------|------|----------|
| Context7 | 库文档查询 | https://context7.com/dashboard |
| Exa | 网页搜索 | https://exa.ai |
| Perplexity | 备用搜索 | https://perplexity.ai |
| Gemini | 视频理解 | https://makersuite.google.com/app/apikey |
| GitHub | 私有仓库 | https://github.com/settings/tokens |

### 4. 生成配置文件

- `.mcp.json` - MCP 服务器配置
- `.pi/web-search.json` - Web 搜索配置
- `.gitignore` - Git 忽略规则

### 5. 可选依赖

- `ffmpeg` - 视频帧提取
- `yt-dlp` - YouTube 视频处理

## 手动配置

如果不使用安装脚本，可以手动配置：

### MCP 配置

创建 `.mcp.json`:

```json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "your-api-key"
      },
      "lifecycle": "lazy"
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "lifecycle": "lazy"
    },
    "codegraph": {
      "command": "codegraph",
      "args": ["serve"],
      "lifecycle": "lazy"
    },
    "semble": {
      "command": "uvx",
      "args": ["--from", "semble[mcp]", "semble"],
      "lifecycle": "lazy"
    },
    "agentmemory": {
      "command": "agentmemory",
      "args": ["serve"],
      "lifecycle": "lazy"
    }
  }
}
```

### Web 搜索配置

创建 `.pi/web-search.json`:

```json
{
  "exaApiKey": "exa-...",
  "perplexityApiKey": "pplx-...",
  "geminiApiKey": "AIza...",
  "workflow": "summary-review"
}
```

## 使用说明

安装完成后，重启 pi 会话：

```bash
pi
```

### MCP 工具使用

```javascript
// Context7 - 搜索库文档
mcp({ search: "React hooks" })

// Context7 - 获取库 ID
mcp({ tool: "context7_resolve-library-id", args: '{"libraryName": "react"}' })

// Context7 - 获取文档
mcp({ tool: "context7_get-library-docs", args: '{"context7CompatibleLibraryId": "/facebook/react"}' })

// Playwright - 浏览器自动化
mcp({ tool: "playwright_navigate", args: '{"url": "https://example.com"}' })

// CodeGraph - 代码搜索
mcp({ search: "authentication flow" })

// Semble - 语义代码搜索
mcp({ search: "database connection" })

// AgentMemory - 记忆检索
mcp({ tool: "agentmemory_recall", args: '{"query": "project setup"}' })
```

### cost-budget 扩展（借鉴 OpenSquilla）

内置成本节约扩展，借鉴 OpenSquilla 的设计，包含 5 个核心功能：

| 功能 | 说明 |
|------|------|
| **工具分类** | EXTERNAL/LOCAL/ARTIFACT/ERROR/CONTROL 六类分级 |
| **输出配额** | 外部工具 32KB/次，本地工具 160KB/次，超过自动裁剪 |
| **拒绝门控** | 检测 URL/代码块/复杂关键词，弹出确认对话框 |
| **成本追踪** | 记录每个会话的 token 消耗和估算成本 |
| **复杂度分类** | c0-c3 四级，自动注入到 system prompt |

#### 可用命令

| 命令 | 功能 |
|------|------|
| `/budget` | 查看当前回合的 EXTERNAL/LOCAL 字符消费 |
| `/cost` | 查看会话成本汇总（按模型分组） |
| `/cost-report` | 导出 JSON 成本报告到 `.pi/cost-reports/` |
| `/complexity <text>` | 测试复杂度分类器输出 |

#### 配置

编辑 `.pi/extensions/cost-budget/config.json`：

```json
{
  "enabled": true,
  "tiers": {
    "c0": { "provider": "deepseek", "model": "deepseek-chat" },
    "c1": { "provider": "deepseek", "model": "deepseek-chat" },
    "c2": { "provider": "deepseek", "model": "deepseek-v4-pro" },
    "c3": { "provider": "deepseek", "model": "deepseek-v4-pro" }
  }
}
```

### Web 搜索使用

```javascript
// 搜索网页
web_search({ query: "TypeScript best practices 2025" })

// 获取网页内容
fetch_content({ url: "https://example.com/article" })

// 分析 YouTube 视频
fetch_content({ url: "https://youtube.com/watch?v=abc", prompt: "What is shown?" })
```

## 目录结构

```
pi-dotfiles/
├── .git/                    # Git 仓库
├── .gitignore               # Git 忽略规则
├── .mcp.json                # MCP 服务器配置
├── .pi/
│   └── web-search.json      # Web 搜索配置
├── install.sh               # 自动化安装脚本
└── README.md                # 本文档
```

## 更新配置

如果需要添加新的 MCP 服务器或修改配置，编辑相应的 JSON 文件后重启 pi 会话。

## 故事排除

### 扩展安装失败

```bash
# 清理 npm 缓存
rm -rf .pi/agent/npm/node_modules
rm -rf .pi/agent/npm/package-lock.json

# 重新安装
pi install npm:pi-mcp-adapter
```

### MCP 服务器连接失败

1. 检查 API Key 是否正确
2. 检查网络连接
3. 运行 `mcp({})` 查看服务器状态

## License

MIT
