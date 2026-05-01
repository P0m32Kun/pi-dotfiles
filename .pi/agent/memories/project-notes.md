# 项目笔记

> 当前正在进行的项目的特定上下文和笔记。
> 按项目分节，方便切换时更新。

## 默认
- 当前工作目录下的项目上下文

## pi-audit-agent
- **技术栈**: TypeScript (Node.js) + Python (uv) + Pi Extension
- **当前阶段**: 单 Agent Auditor 能力稳定，流水线设计 v1 待实施
- **关键约定**:
  - `.audit/` 是真实状态源，所有重要状态必须落盘
  - 能力缺口默认归类顺序：agent → skill → tool → extension → audit-core
  - 先补通用能力，再考虑代码层特化
  - 安全红线：shell 注入、路径遍历、symlink 逃逸已修复（P0）
- **测试基线**: 94 tests passing (2026-04-28)
- **活跃技能**: 8 审计技能 + 2 流水线角色技能 (deployer/exploiter)
- **设计文档**: v3 主设计 (`pi_code_audit_agent_design.md`) + v1 流水线设计 (`pi_audit_pipeline_design.md`)
- **包管理**: pnpm (Node) + uv (Python)
