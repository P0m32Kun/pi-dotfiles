---
name: quick
description: |
  Lightweight fast track: align → understand → implement → review → commit.
  For small changes: bug fixes, minor refactors, config changes, doc updates, single-file edits.
  Triggers on: 修复, 小改动, 配置, 文档, bug fix, quick fix, /quick.
---

## Step 0: align (lightweight)

output: alignment-brief.md

加载 align skill（快速模式），评估 {task}：

- 简单修复（≤3 文件，已知接口，无新域概念）→ 标记 fast-track，简要确认
- 有不确定性 → 轻量 grilling（最多 3 个问题）
- 产出对齐摘要（接口、行为、边界）
- 用户可随时说 "跳过对齐" 或 "直接开始" 以 fast-track

## Step 1: explorer

output: context.md
reads: alignment-brief.md

基于对齐摘要，快速理解上下文：

- 搜索相关文件和代码
- 理解现有模式和约定
- 确定改动范围（目标 ≤ 3 个文件）

## Step 2: coder

output: implementation.md
reads: context.md, alignment-brief.md

coder agent 实现改动：

- 最小化变更集
- 遵循现有代码风格
- 如果是 bug 修复，写回归测试
- 验证对齐摘要中的验收标准

## Step 3: reviewer

output: review.md
reads: implementation.md, context.md, alignment-brief.md

快速审查：

- 实现是否正确
- 边界情况是否处理（对照对齐摘要）
- 测试是否合理
- 修复发现的问题

## Step 4: cap-commit-push

output: commit-report.md
reads: review.md

提交并推送：

- 生成 conventional commit
- push 到远程仓库
- 输出变更摘要
