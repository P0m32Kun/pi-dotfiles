# Skill 进化计划

## 当前状态（2026-05-02）

本轮重构已完成，新增 `align` skill，重构 `implement-with-review` / `dev-workflow` / `quick` chain，更新 `CLAUDE.md`。

当前技能数量：**32 个**（目标：< 25）

## 验证驱动策略

**原则：先观察后增强，不好则剔除。**

不要一次性增加过多技能。每个新技能必须经过真实场景的验证，证明它能减少返工或提升质量，才能保留。

## 观察期（2-4 周）

### 重点观察项

1. **align skill 效果**
   - 是否减少了"不是我要的"返工？
   - fast-track 比例是否合理（目标：30-50%）？
   - 用户是否觉得 grilling 有价值？

2. **diagnose vs debugging-and-error-recovery**
   - 复杂 bug 场景下哪个更实用？
   - 是否应将前者合并进后者？

3. **未触发技能候选**
   - 以下技能如果 4 周内零触发，考虑归档：
     - `harness-init-runner`（56行，极特定场景）
     - `proactive-compaction`（概念好但可能无人主动调用）
     - `agent-browser`（51行过薄，或合并到 playwright-e2e-testing）
     - `research-and-implement`（可被 researcher + implement-with-review 覆盖）

### 评审节奏

| 周次    | 动作                                     |
| ------- | ---------------------------------------- |
| 第 1 周 | 观察 align 触发频率和用户反馈            |
| 第 2 周 | 评估 fast-track 比例和 diagnose 使用情况 |
| 第 3 周 | 识别从未触发的技能候选                   |
| 第 4 周 | 做一轮技能清理 + 内容增强                |

### 评审三问

每次评估一个 skill 时问自己：

1. **这个 skill 本月被触发过吗？**（没触发 → 考虑归档）
2. **触发后产出质量如何？**（质量差 → 重写或删除）
3. **是否有其他 skill 可以替代它？**（可替代 → 合并）

## 候选合并

| 技能 A                         | 技能 B                    | 合并方向                             |
| ------------------------------ | ------------------------- | ------------------------------------ |
| `debugging-and-error-recovery` | `diagnose`                | 吸收 diagnose 的 Phase 1（反馈循环） |
| `oracle-consult`               | `align`                   | oracle 的决策逻辑并入 align          |
| `design-review`                | `code-review-and-quality` | 设计评审并入代码审查                 |

## 执行记录

| 日期       | 动作                                                      | 结果             |
| ---------- | --------------------------------------------------------- | ---------------- |
| 2026-05-02 | 新建 align，重构 implement-with-review/dev-workflow/quick | 完成，进入观察期 |

---

_本文件每次 skill 变更后更新。归档的 skill 移动到 `.agents/skills/.archived/` 并记录原因。_
