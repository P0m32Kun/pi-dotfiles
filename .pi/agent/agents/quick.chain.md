---
name: quick
description: |
  轻量快速通道：理解 → 实现 → 审查 → 提交。
  适用于小型改动：Bug 修复、小重构、配置变更、文档更新、单文件改动。
  Triggers on: 修复, 小改动, 配置, 文档, bug fix, quick fix, /quick.
---

## Step 1: explorer
output: context.md

快速理解 {task} 的上下文：
- 搜索相关文件和代码
- 理解现有模式和约定
- 确定改动范围（目标 ≤ 3 个文件）

## Step 2: coder
output: implementation.md
reads: context.md

coder agent 实现改动：
- 最小化变更集
- 遵循现有代码风格
- 如果是 bug 修复，写回归测试

## Step 3: reviewer
output: review.md
reads: implementation.md, context.md

快速审查：
- 实现是否正确
- 边界情况是否处理
- 测试是否合理
- 修复发现的问题

## Step 4: cap-commit-push
output: commit-report.md
reads: review.md

提交并推送：
- 生成 conventional commit
- push 到远程仓库
- 输出变更摘要
