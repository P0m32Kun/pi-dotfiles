# Pi 配置仓库

Pi coding agent 的跨设备同步配置。通过 symlink 挂载到 `~/.pi` 和 `~/.agents`。

## 快速开始（新设备）

```bash
git clone <你的私有仓库> ~/pi-dotfiles
cd ~/pi-dotfiles
./install.sh
```

`install.sh` 会自动备份现有配置并创建 symlink。

## 日常同步

因为使用 symlink，所有对 `~/.pi` 和 `~/.agents` 的修改**直接作用于本仓库**：

```bash
cd ~/pi-dotfiles
git add .
git commit -m "update config"
git push
```

## 敏感信息

以下文件被 `.gitignore` 排除，不会进仓库：

| 文件 | 说明 | 恢复方式 |
|------|------|---------|
| `.pi/agent/auth.json` | API 密钥、token | 运行 pi 后自动生成，或从 1Password 恢复 |
| `.pi/agent/mcp.json` | MCP 服务器配置（含密钥） | 手动重新配置 |
| `.pi/agent/mcp-cache.json` | MCP 运行时缓存 | 自动生成 |
| `.agents/.skill-lock.json` | Skill 安装锁文件 | 自动生成 |

## 结构

```
.pi/                    → ~/.pi
├── agent/
│   ├── CLAUDE.md       # 主配置
│   ├── settings.json   # 模型设置
│   ├── models.json     # 自定义模型
│   ├── agents/         # 自定义 chain/agent
│   ├── prompts/        # 自定义 prompt
│   ├── memories/       # 长期记忆
│   └── skills/         # skill symlink → ~/.agents/skills
└── ...

.agents/                → ~/.agents
└── skills/             # 实际 skill 文件
    ├── implement-with-review/
    ├── code-review-and-quality/
    └── ...
```
