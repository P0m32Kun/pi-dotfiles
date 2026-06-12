# Agents Guide

> 本文档专门为 AI agent 设计，帮助快速理解仓库上下文和工作约定。

## 一句话定义

这是 **Pi coding agent 的配置仓库**，提供一键安装脚本和 MCP 服务器配置，用于快速搭建 AI 编程环境。

## 核心目标

1. **简化配置** - 一个脚本完成所有插件、MCP 服务器、API Key 的配置
2. **版本管理** - 配置文件版本化，便于迁移和回滚
3. **文档驱动** - README 提供完整的人类文档，本文档提供 agent 上下文

## 文件结构

```
pi-dotfiles/
├── agents.md              # 👈 你在这里 - agent 理解仓库用
├── README.md              # 人类用户文档（详细使用说明）
├── install.sh             # 安装脚本（核心文件，谨慎修改）
├── .mcp.json              # MCP 服务器配置
├── .pi/
│   ├── web-search.json    # Web 搜索配置（API keys）
│   └── extensions/        # Pi 扩展配置
├── package.json           # Node.js 项目元数据
├── vitest.config.ts       # 测试配置
└── .gitignore             # Git 忽略规则
```

## 关键文件说明

### install.sh（核心）
- 一键安装脚本，约 900 行
- 功能：安装插件、配置 MCP、设置 API keys
- **修改风险**：高 - 影响所有用户的安装体验
- **测试方式**：运行 `./install.sh` 验证

### .mcp.json
- MCP 服务器连接配置
- 包含 context7、playwright、semble 等服务器
- **注意**：API keys 可能硬编码，提交前检查

### .pi/web-search.json
- Web 搜索工具的 API 配置
- 包含 exa、perplexity、gemini 等 key
- **注意**：敏感文件，已在 .gitignore 中

## 工作约定

### 修改前
1. 先阅读 README.md 了解完整上下文
2. 检查修改是否影响 install.sh 的逻辑
3. 确认 .gitignore 是否需要更新

### 修改后
1. 运行测试验证：`npm test`
2. 如果修改了 install.sh，手动测试安装流程
3. 更新 README.md 保持文档同步
4. 检查是否泄露 API keys

### 代码风格
- Shell 脚本：遵循 Google Shell Style Guide
- JSON：2 空格缩进
- Markdown：中文文档，保持简洁

## 测试与验证

```bash
# 运行单元测试
npm test

# 监听模式
npm run test:watch

# 手动测试安装脚本
./install.sh
```

## 敏感信息

以下文件**不应提交到 Git**：
- `.pi/agent/auth.json` - 认证信息
- `.pi/agent/mcp.json` - 运行时 MCP 配置
- `.pi/memory/` - 记忆数据
- `.pi/agent/sessions/` - 会话数据

## 常见任务

### 添加新的 MCP 服务器
1. 编辑 `.mcp.json` 添加服务器配置
2. 更新 `install.sh` 中的安装逻辑
3. 更新 README.md 的 MCP 配置说明
4. 测试连接

### 添加新的扩展
1. 在 `install.sh` 的 `install_extensions()` 函数中添加
2. 更新 README.md 的扩展表格
3. 测试扩展功能

### 更新 API Keys
1. 编辑 `.pi/web-search.json`
2. **不要**将 keys 提交到 Git
3. 提醒用户在自己的环境配置

## 仓库边界

### 这个仓库是
- Pi coding agent 的配置模板
- 安装脚本和文档
- MCP 服务器配置示例

### 这个仓库不是
- Pi agent 本身的源代码
- 扩展的源代码仓库
- 运行时数据存储

## 相关链接

- **Pi 官方文档**：https://docs.anthropic.com/en/docs/agents-and-tools/pi
- **Pi GitHub**：https://github.com/anthropics/pi-coding-agent
- **仓库地址**：https://github.com/P0m32Kun/pi-dotfiles

---

*最后更新：2026-06-12*
