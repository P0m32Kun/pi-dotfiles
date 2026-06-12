# Pi-subagents vs Multi-agent 以及扩展与 Skills 边界问题分析

## 问题 1: Pi-subagents 与 Multi-agent 扩展重叠

### 功能对比

| 功能 | pi-subagents | pi-multi-agent |
|------|--------------|----------------|
| **单个代理** | ✅ `subagent({agent, task})` | ✅ `multi_agent({agent, task})` |
| **并行代理** | ✅ `subagent({tasks: [...]})` | ✅ `multi_agent({tasks: [...]})` |
| **链式代理** | ✅ `subagent({chain: [...]})` | ✅ `multi_agent({steps: [...]})` |
| **任务分解** | ❌ 无 | ✅ `task_decompose()` |
| **结果聚合** | ❌ 无 | ✅ `result_aggregate()` |
| **自动模式** | ❌ 无 | ✅ `multi_agent({autoTask})` |
| **Agent 管理** | ✅ 创建/更新/删除 agent | ❌ 无 |
| **异步执行** | ✅ `async: true` | ❌ 无 |
| **上下文控制** | ✅ fresh/fork | ❌ 无 |
| **子代理控制** | ✅ interrupt/resume/status | ❌ 无 |
| **Intercom 协调** | ✅ 需要 pi-intercom | ❌ 无 |
| **工作流模板** | ✅ 8 个内置工作流 | ❌ 无 |
| **Builtin Agents** | ✅ scout/worker/reviewer/oracle 等 | ❌ 只有 coder/tester/reviewer |

### 核心差异

**pi-subagents** 是一个**完整的编排框架**：
- 提供 agent 生命周期管理（创建/更新/删除）
- 支持异步执行和长时间运行
- 支持上下文隔离（fresh/fork）
- 提供丰富的工作流模板（parallel-review, review-loop 等）
- 支持 intercom 协调
- 支持子代理控制（interrupt/resume/status）

**pi-multi-agent** 是一个**轻量级工具**：
- 提供简单的任务分解和结果聚合
- 支持自动模式（autoTask）
- 更简单的 API
- 但缺少异步、上下文控制、agent 管理等高级功能

### 解决方案

**方案 A: 保留 pi-subagents，移除 pi-multi-agent**

理由：
1. pi-subagents 功能更完整
2. pi-subagents 是 pi 官方推荐的多代理方案
3. pi-multi-agent 的功能可以被 pi-subagents 覆盖

迁移方式：
- `task_decompose` → 使用 pi-subagents 的 `planner` agent
- `result_aggregate` → 使用 pi-subagents 的 chain 模式自动聚合
- `autoTask` → 使用 pi-subagents 的工作流模板

**方案 B: 保留两者，明确分工**

理由：
1. pi-multi-agent 更简单，适合快速原型
2. pi-subagents 更强大，适合复杂场景

分工方式：
- pi-multi-agent：简单任务、快速原型、单次执行
- pi-subagents：复杂工作流、长期运行、需要协调的场景

**方案 C: 整合 pi-multi-agent 的独特功能到 pi-subagents**

理由：
1. 保留 pi-subagents 的完整性
2. 吸收 pi-multi-agent 的优点

整合内容：
- 将 `task_decompose` 作为 pi-subagents 的工具
- 将 `autoTask` 作为 pi-subagents 的工作流模板
- 移除 pi-multi-agent 扩展

---

## 问题 2: 扩展与 Skills 边界模糊

### 功能对比

| 扩展 | 对应的 Skill | 关系 |
|------|--------------|------|
| pi-workflow-engine | develop-feature | 扩展提供底层引擎，skill 提供高层流程 |
| pi-loop-engine | iterative-refinement | 扩展提供自动重试，skill 提供方法论 |
| pi-test-integration | tdd, test-strategy | 扩展提供工具，skills 提供方法论 |

### 核心问题

1. **功能边界不清晰**：用户不知道何时用扩展，何时用 skill
2. **可能的重复**：扩展和 skill 可能在某些功能上重复
3. **维护成本**：需要维护两套系统

### 分析各对关系

#### pi-workflow-engine ↔ develop-feature

**pi-workflow-engine** 提供：
- 工作流定义（JSON/YAML）
- 步骤依赖解析
- 并行执行
- 状态机
- 错误处理（重试/跳过/回滚）

**develop-feature** 提供：
- 完整的开发流程（Research → Design → Implement → Doc-Sync → Verify → Release）
- 每个阶段的具体方法论
- 阶段间的阻断条件
- 回退机制

**关系**：互补，不重复
- pi-workflow-engine 是底层执行引擎
- develop-feature 是高层流程编排
- develop-feature 可以使用 pi-workflow-engine 来执行

#### pi-loop-engine ↔ iterative-refinement

**pi-loop-engine** 提供：
- 自动失败检测
- 自动重试机制
- 条件分支
- 循环支持
- 状态持久化
- VISION.md 防漂移

**iterative-refinement** 提供：
- 三层 Loop 模型（Task/Stage/Workflow）
- 显式退出条件
- 收敛信号
- 状态追踪格式

**关系**：互补，不重复
- pi-loop-engine 是自动化工具
- iterative-refinement 是方法论指导
- pi-loop-engine 实现了 iterative-refinement 的部分模式

#### pi-test-integration ↔ tdd/test-strategy

**pi-test-integration** 提供：
- 测试框架自动检测
- 测试运行
- 失败分析

**tdd** 提供：
- 红绿重构循环
- 测试隔离规则
- Mock 指南

**test-strategy** 提供：
- 测试层级选择
- 决策树
- 测试计划模板

**关系**：互补，不重复
- pi-test-integration 是工具层
- tdd/test-strategy 是方法论层
- 使用 tdd 时会调用 pi-test-integration 的工具

### 解决方案

**方案 A: 明确定位，保持现状**

在文档中明确说明：
- **扩展**：提供底层工具和自动化机制
- **Skills**：提供方法论和最佳实践
- **关系**：Skills 使用扩展提供的工具来实现方法论

示例文档结构：
```
## 扩展 vs Skills

### 扩展（工具层）
- pi-workflow-engine：工作流执行引擎
- pi-loop-engine：自动重试引擎
- pi-test-integration：测试框架集成

### Skills（方法论层）
- develop-feature：使用 workflow-engine 的开发流程
- iterative-refinement：使用 loop-engine 的迭代方法
- tdd：使用 test-integration 的测试驱动开发

### 使用方式
1. 选择方法论（Skill）
2. Skill 自动调用对应的扩展工具
3. 用户无需直接使用扩展
```

**方案 B: 整合扩展功能到 Skills**

将扩展的功能整合到对应的 Skills 中：
- develop-feature 内置 workflow-engine 功能
- iterative-refinement 内置 loop-engine 功能
- tdd 内置 test-integration 功能

优点：
- 简化架构
- 减少维护成本
- 用户只需了解 Skills

缺点：
- Skills 变得更复杂
- 可能失去扩展的灵活性

**方案 C: 将 Skills 转换为扩展的配置**

将 Skills 作为扩展的配置/预设：
- develop-feature → workflow-engine 的预设工作流
- iterative-refinement → loop-engine 的配置模板
- tdd → test-integration 的使用指南

优点：
- 统一架构
- 扩展是唯一的功能提供者

缺点：
- 失去 Skills 的方法论价值
- 用户需要了解扩展的细节

---

## 推荐方案

### 对于问题 1（Pi-subagents vs Multi-agent）

**推荐方案 A：保留 pi-subagents，移除 pi-multi-agent**

理由：
1. pi-subagents 功能更完整
2. 减少用户的选择困难
3. pi-multi-agent 的独特功能（task_decompose, autoTask）可以后续整合到 pi-subagents

实施步骤：
1. 在 pi-subagents 中添加 task_decompose 工具
2. 在 pi-subagents 中添加 autoTask 工作流模板
3. 移除 pi-multi-agent 扩展
4. 更新文档

### 对于问题 2（扩展与 Skills 边界）

**推荐方案 A：明确定位，保持现状**

理由：
1. 扩展和 Skills 确实有不同的定位
2. 保持现状可以保持灵活性
3. 只需要更好的文档

实施步骤：
1. 在每个 Skill 的文档中添加"依赖的扩展"部分
2. 在每个扩展的文档中添加"相关的 Skills"部分
3. 添加整体架构文档，说明扩展和 Skills 的关系
4. 添加使用场景指南

---

## 实施计划

### 阶段 1：解决 Pi-subagents vs Multi-agent（1-2 天）

#### 1.1 分析 pi-multi-agent 的独特功能
```bash
# 检查 pi-multi-agent 的工具
- multi_agent: 主工具，支持 single/parallel/chain/auto 模式
- agent_list: 列出可用代理
- task_decompose: 任务分解
- result_aggregate: 结果聚合
```

#### 1.2 将独特功能整合到 pi-subagents

**task_decompose 整合方案：**
```typescript
// 在 pi-subagents 中添加 task_decompose 工具
subagent({
  action: "create",
  config: {
    name: "task-decomposer",
    description: "将复杂任务分解为子任务",
    tools: "read,grep,find,ls,bash"
  }
})
```

**autoTask 整合方案：**
```typescript
// 在 pi-subagents 中添加 autoTask 工作流
subagent({
  agent: "planner",
  task: "自动分解并执行: ${autoTask}",
  chain: [
    { agent: "planner", task: "分析任务并制定计划" },
    { agent: "worker", task: "执行计划" },
    { agent: "reviewer", task: "审查结果" }
  ]
})
```

#### 1.3 移除 pi-multi-agent 扩展
```bash
# 备份
mv ~/.pi/agent/extensions/pi-multi-agent ~/.pi/agent/extensions/pi-multi-agent.bak

# 或直接删除
rm -rf ~/.pi/agent/extensions/pi-multi-agent
```

#### 1.4 更新文档
- 更新 README.md，说明使用 pi-subagents
- 迁移指南：pi-multi-agent → pi-subagents

### 阶段 2：明确扩展与 Skills 边界（2-3 天）

#### 2.1 为每个 Skill 添加"依赖的扩展"部分

**develop-feature/SKILL.md:**
```markdown
## 依赖的扩展
- pi-workflow-engine: 用于执行工作流步骤
- pi-loop-engine: 用于自动重试失败的步骤
```

tdd/SKILL.md:
```markdown
## 依赖的扩展
- pi-test-integration: 用于运行测试和分析失败
```

iterative-refinement/SKILL.md:
```markdown
## 依赖的扩展
- pi-loop-engine: 用于自动重试和条件分支
```

#### 2.2 为每个扩展添加"相关的 Skills"部分

**pi-workflow-engine/README.md:**
```markdown
## 相关的 Skills
- develop-feature: 使用本扩展执行开发流程
- deploy: 使用本扩展执行部署流程
```

pi-loop-engine/README.md:
```markdown
## 相关的 Skills
- iterative-refinement: 使用本扩展实现迭代重试
- fix-bug: 使用本扩展自动重试修复
```

pi-test-integration/README.md:
```markdown
## 相关的 Skills
- tdd: 使用本扩展运行测试
- test-strategy: 使用本扩展检测测试框架
```

#### 2.3 创建整体架构文档

创建 docs/architecture.md:
```markdown
# Pi-Coding-Agent 架构

## 分层架构

```
┌─────────────────────────────────────────────┐
│  Skills 层（方法论和最佳实践）                │
│  - develop-feature: 完整开发流程              │
│  - tdd: 测试驱动开发                          │
│  - iterative-refinement: 迭代精炼            │
├─────────────────────────────────────────────┤
│  Extensions 层（工具和自动化）                │
│  - pi-workflow-engine: 工作流执行            │
│  - pi-loop-engine: 自动重试                  │
│  - pi-test-integration: 测试集成            │
├─────────────────────────────────────────────┤
│  Core 层（基础功能）                          │
│  - read/write/edit/bash: 基础工具            │
│  - subagent: 子代理框架                      │
└─────────────────────────────────────────────┘
```

## 关系说明

- Skills 使用 Extensions 提供的工具
- Extensions 使用 Core 提供的基础功能
- 用户通常只需要了解 Skills
- 高级用户可以直接使用 Extensions
```

#### 2.4 创建使用场景指南

创建 docs/usage-guide.md:
```markdown
# 使用场景指南

## 场景 1: 开发新功能

**推荐使用:**
- Skill: develop-feature
- 自动调用: pi-workflow-engine, pi-loop-engine

**流程:**
1. develop-feature 编排整个流程
2. 使用 brainstorming 进行需求分析
3. 使用 openspec 定义 spec
4. 使用 tdd 实现代码
5. 使用 verify 进行验收

## 场景 2: 修复 Bug

**推荐使用:**
- Skill: fix-bug
- 自动调用: pi-loop-engine

**流程:**
1. fix-bug 指导诊断过程
2. pi-loop-engine 自动重试失败的修复

## 场景 3: 运行测试

**推荐使用:**
- 直接使用: pi-test-integration
- 或使用 Skill: tdd

**流程:**
1. test_run 运行测试
2. test_analyze 分析失败
3. tdd 指导测试驱动开发
```

### 阶段 3：优化和验证（持续）

1. 收集用户反馈
2. 优化文档
3. 考虑进一步整合
