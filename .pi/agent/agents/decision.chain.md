---
name: decision
description: |
  架构决策工作流：研究 → 评估 → ADR。
  适用于技术选型、架构方案对比、迁移策略制定。
  Triggers on: 架构, 技术选型, should I use, A or B, 方案对比, 迁移, /decision.
---

## Step 1: researcher
output: research-brief.md

研究 {task}：
- 当前最佳实践
- 成熟方案对比
- 已知踩坑记录
- 社区案例和经验

## Step 2: oracle
output: decision-matrix.md
reads: research-brief.md

加载 oracle-consult skill，评估方案并输出决策矩阵：
- 至少 3 个备选方案
- 决策框架评估：
  - 成熟度 vs 前沿性
  - 维护负担
  - 安全性
  - 性能
  - 简单性
- 明确推荐 + 理由
- 迁移路径
- 挑战假设，识别隐藏风险

## Step 3: coder
output: adr.md
reads: decision-matrix.md

加载 oracle-consult skill，coder agent 输出 ADR (Architecture Decision Record)：
- Context: 决策背景
- Decision: 最终决策
- Consequences: 影响和风险
- Alternatives: 被否决的方案 + 理由
- 建议放置位置
