# 用户编码偏好

> 此文件记录你的编码风格偏好，pi 会在每次会话开始时自动加载。
> 格式：`- YYYY-MM-DD: 具体内容`

## 语言偏好
- 2025-01-15: 优先使用 Go 处理网络/安全工具，Rust 处理高性能场景，Python 做自动化脚本
- 2025-01-15: 前端使用 React + TypeScript + Tailwind v4

## 代码风格
- 2025-02-01: Go 代码必须显式处理 error，禁止忽略；使用 table-driven tests
- 2025-02-01: Rust 优先用 `?` 传播错误，async 用 Tokio
- 2025-02-01: Python 类型注解必须完整，不用 `Any` 偷懒

## 工具偏好
- 2025-03-01: 网络代码必须设置 timeout 和 connection cleanup
- 2025-03-01: 安全工具绝不 log 敏感信息（token/credential）
- 2026-04-28: Python 环境管理必须使用 uv，禁止直接使用 pip / venv / conda
- 2026-04-28: Node.js 包管理必须使用 pnpm，禁止直接使用 npm / yarn
- 2026-05-01: 使用 GitNexus MCP 了解项目代码结构（gitnexus_query、gitnexus_context、gitnexus_impact 等），比直接 grep/find 搜索更节约 token。优先使用 MCP 工具而非 bash 搜索。
