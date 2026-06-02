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

### 2. 配置 MCP 服务器

- **Context7**: 获取最新库文档

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
// 搜索库文档
mcp({ search: "React hooks" })

// 获取库 ID
mcp({ tool: "context7_resolve-library-id", args: '{"libraryName": "react"}' })

// 获取文档
mcp({ tool: "context7_get-library-docs", args: '{"context7CompatibleLibraryId": "/facebook/react"}' })
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
