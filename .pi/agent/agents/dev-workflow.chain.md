---
name: dev-workflow
description: |
  完整功能开发工作流：设计 → 评审 → 并行开发 → 审查 → 简化 → 测试 → 归档 → 推送。
  适用于大型功能开发、跨模块改动、前后端联调。
  Triggers on: 新功能, 大型改动, 跨模块, 前后端联调, 完整流程, /dev.
---

## Step 1: explorer
output: design-plan.md

加载 recon-and-plan skill，分析 {task}，输出设计+计划合二为一的文档。包含：
- 需求分析与边界定义
- 架构方案（至少 2 个备选 + 推荐）
- 垂直切片任务拆分（每个切片 ≤ 5 个文件）
- 依赖图与执行顺序
- 风险评估与缓解策略
- 验收标准

## Step 2: design-review (并行多模型评审)
output: review-summary.md
reads: design-plan.md

加载 design-review skill，将 design-plan.md 并行分发给配置的多个模型进行独立评审。
收集各模型的分析、优化建议和补充意见，汇总为评审摘要。
输出：各模型评审意见 + 汇总建议 + 争议点标记。

## ---- 人类检查点: 确认方案 ----
等待用户确认方案或调整意见后继续。

## Step 3: oracle
output: final-design.md
reads: design-plan.md, review-summary.md

加载 oracle-consult skill，整合评审意见并输出最终设计方案：
- 挑战假设，识别隐藏风险
- 采纳合理的优化建议
- 回复有争议的点（给出理由）
- 更新任务拆分和执行顺序
- 标注已解决/待讨论的评审意见

## Step 4: parallel-implementation (并行开发)
output: implementation-report.md
reads: final-design.md

加载 parallel-implementation skill，按 final-design.md 的垂直切片并行开发：
- 自动分析可拆分性，创建 worktree 隔离
- 每个切片由 coder agent 独立实现 + 测试
- 合并结果，输出实现报告（变更文件列表、测试结果、合并状态）

## Step 5: code-review
output: review-report.md
reads: implementation-report.md

加载 code-review-and-quality skill，由 reviewer agent 执行五维度审查：
- 正确性：实现是否匹配设计方案
- 可读性：代码是否清晰易懂
- 架构：是否遵循项目约定
- 安全：是否有安全风险
- 性能：是否有性能问题

输出审查报告，含 P0-P3 分级的问题列表。

## Step 6: code-simplify
output: simplification-report.md
reads: review-report.md

加载 code-simplification skill，消除过度工程：
- 消除不必要的抽象
- 简化复杂逻辑
- 提升可读性
- 保持行为不变

输出简化报告（变更摘要）。

## ---- 人类检查点: 确认代码 ----
等待用户确认代码质量后继续。

## Step 7: qa-pass
output: test-report.md
reads: simplification-report.md

加载 test-driven-development 和 golang-testing skill，coder agent 执行功能测试 + 回归测试：
- 运行完整测试套件（-race 标志）
- 验证验收标准
- 检查边界情况
- 输出测试报告

## Step 8: archive-docs
output: archive-report.md
reads: test-report.md

整理文档（由主 agent 直接执行）：
- 扫描并归档临时设计文档、评审草稿到 docs/archive/
- 更新 docs/README.md 索引
- 清理根目录临时文件
- 为归档文档添加 frontmatter 标记（archived_at, status）

## Step 9: cap-commit-push
output: commit-report.md
reads: archive-report.md

加载 cap-commit-push skill：
- 分析所有变更
- 生成原子 commit（conventional commit 格式）
- push 到远程仓库

## ---- 人类检查点: 确认发布 ----
通知用户完成，展示变更摘要和 commit 信息。
