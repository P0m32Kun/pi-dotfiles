---
name: proactive-compaction
description: |
  Proactive context compaction strategy. Trigger at milestone moments to compact
  session context BEFORE it hits the limit, using focused instructions to preserve
  critical decisions, open tasks, and file relationships. Prevents the quality
  degradation that happens when passive compaction kicks in at the last moment.
---

# Proactive Compaction

在会话达到 token 上限之前主动压缩上下文，避免被动压缩导致的质量衰减。

## Why This Matters

**被动压缩的问题：**
- Pi 的 auto-compaction 在 `contextTokens > contextWindow - reserveTokens` 时才触发
- 此时几乎没有 token 余量，摘要被迫丢弃大量信息
- 关键决策、未完成的 TODO、测试状态、文件依赖关系容易丢失
- 压缩后 agent 频繁问"你之前说要做什么来着？"

**主动压缩的优势：**
- 在 milestone 完成时（此时上下文还充裕）立即压缩
- 提供聚焦指令（instructions），告诉 compaction 哪些信息绝对不能丢
- 保留的信息密度比被动压缩高 2-3 倍
- 会话可以持续更长而不降低输出质量

## When to Trigger

### 自动触发条件（满足任一即建议压缩）

| 条件 | 说明 |
|------|------|
| **完成 Milestone** | 一个功能实现完成、一个 bug 修复完成、一组测试写完、一次重构完成 |
| **对话轮数** | 当前 session 已进行 **≥15 轮** 对话（估算约 60-80K tokens） |
| **大动作前** | 即将执行大量文件读取、运行全量测试、启动子 agent |
| **质量下降信号** | Agent 开始重复之前已经确认过的决策、询问已讨论过的问题 |
| **提交后** | `cap-commit-push` 完成后，如果 session 已较长 |

### 不触发的场景

- 当前正在一个未完成的逻辑中间（如写了一半的函数）
- 刚切换到新分支，上下文还没积累多少
- 用户明确说"不要压缩"或正在调试中需要完整历史

## Compaction Instructions Template

执行 `/compact` 时，附加聚焦指令。指令用自然语言，按优先级排列：

```
/compact 保留以下信息：
- 关键决策：[列出已做出的架构/设计决策及其原因]
- 未完成项：[列出尚未完成的任务、TODO、待修复的问题]
- 文件状态：[列出已修改/已读的关键文件及其当前状态]
- 测试状态：[哪些测试通过/失败，是否需要补充]
- 依赖关系：[模块间调用关系、新增/删除的依赖]
- 用户的显式偏好：[用户指定的技术选型、风格要求等]
```

### Instructions 示例

**场景：完成一个功能后**
```
/compact 保留：
1. 已决定用 goroutine + channel 做并发（不要改成 sync.WaitGroup）
2. auth 模块的 ValidateToken 接口签名已确定（token string）→ (claims, error)
3. 测试覆盖率当前 78%，还需要补边界测试
4. 已读文件：pkg/auth/token.go, pkg/auth/verify.go, internal/middleware/auth.go
5. 尚未开始：集成测试、错误码统一
```

**场景：修复 bug 后**
```
/compact 保留：
1. 根因：race condition 在并发读写 config map
2. 修复方案：用 sync.RWMutex 保护，不要用 sync.Map（用户要求）
3. 已验证：1000 次并发测试通过
4. 尚未验证：生产环境压力测试
5. 已修改文件：internal/config/manager.go
```

**场景：重构前准备**
```
/compact 保留：
1. 重构目标：将 db 包拆成 repository + service 两层
2. 已迁移：user_repo.go, order_repo.go
3. 尚未迁移：product_repo.go, payment_repo.go
4. 迁移规则：repo 只做 CRUD，service 放业务逻辑
```

## 信息保留优先级

生成 compact 指令时按此优先级决定保留什么：

| 优先级 | 信息类型 | 为什么必须保留 |
|--------|---------|--------------|
| 🔴 P0 | 关键决策 + 原因 | 避免重复讨论已决定的事 |
| 🔴 P0 | 未完成的 TODO / blocker | 防止任务被遗忘 |
| 🟡 P1 | 已修改文件的当前状态 | 防止误操作或重复编辑 |
| 🟡 P1 | 测试通过/失败状态 | 避免重复运行测试 |
| 🟢 P2 | 已读文件的摘要 | 防止重复读取大文件 |
| 🟢 P2 | 用户的偏好/约束 | 保持一致性 |
| ⚪ P3 | 完整的工具输出 | 可以重新生成 |
| ⚪ P3 | 中间推导过程 | 只保留结论 |

## 压缩后工作流

压缩完成后，agent 应该：

1. **验证保留信息** — 快速检查 summary 是否包含了关键决策和 TODO
2. **恢复上下文** — 如果压缩后 agent 需要继续工作，先重新读取关键文件
3. **继续工作** — 基于 summary 中的信息继续下一个 milestone

## 集成建议

- 与 `cap-commit-push` 配合：提交完成后如果会话较长，建议 `/compact`
- 与 `feature-dev` chain 配合：每个 slice 完成后主动压缩
- 与 `bug-fix` chain 配合：修复验证通过后主动压缩

## 反模式

❌ 不要在压缩指令中写"保留所有信息" — 这等于没压缩  
❌ 不要在未完成的逻辑中间压缩 — 会丢失上下文导致接不上  
❌ 不要在调试中途压缩 — 堆栈、错误信息会被截断  
❌ 不要只写"保留代码改动" — 决策和 WHY 更重要
