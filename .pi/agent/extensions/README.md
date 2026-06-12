# Pi Extensions

pi-coding-agent 扩展集合，提供迭代重试、工作流编排、多代理协作和测试框架集成能力。

## 扩展列表

| 扩展 | 版本 | 说明 | 测试数 |
|------|------|------|--------|
| [pi-loop-engine](./pi-loop-engine/) | 1.0.0 | 迭代重试引擎，支持条件分支、循环、状态持久化 | 44 |
| [pi-workflow-engine](./pi-workflow-engine/) | 1.0.0 | 工作流编排，支持状态机、并行执行、错误处理 | 50 |
| [pi-test-integration](./pi-test-integration/) | 1.0.0 | 测试框架集成，支持 Vitest/Jest/Pytest | 19 |

**总计: 113 个测试**

> **多代理功能已迁移至 pi-subagents 扩展**（通过 npm 包安装）。
> 原 pi-multi-agent 的工具现在通过 `subagent(...)` 统一调用，详见下方迁移指南。

## 快速开始

### 安装

扩展已安装在 `~/.pi/agent/extensions/` 目录，pi 会自动加载。

### 验证安装

```bash
# 运行所有测试
cd ~/.pi/agent/extensions
npm test  # 在各扩展目录中运行

# 或运行集成测试
cd ~/.pi
npm test
```

## 核心功能

### 1. pi-loop-engine (迭代重试)

自动检测失败并重试，支持：
- **条件分支**: 根据条件选择执行路径
- **循环**: while/for 循环支持
- **状态持久化**: 断点续传
- **多种重试策略**: 立即、退避、自适应

```javascript
// 条件分支
loop_branch({
  condition: 'testPassed',
  trueSteps: [{ id: 'deploy', execute: () => deploy() }],
  falseSteps: [{ id: 'fix', execute: () => fix() }]
})

// 循环
loop_while({
  condition: () => counter < 5,
  body: [{ id: 'step', execute: () => step() }]
})
```

### 2. pi-workflow-engine (工作流编排)

定义和执行复杂工作流，支持：
- **步骤依赖**: 自动解析执行顺序
- **并行执行**: 并发执行多个步骤
- **状态机**: 管理工作流状态
- **错误处理**: 重试、跳过、回滚

```javascript
// 加载工作流
workflow_load({
  name: 'deploy',
  definition: {
    steps: [
      { id: 'test', tool: 'bash', args: { command: 'npm test' } },
      { id: 'build', tool: 'bash', args: { command: 'npm run build' }, depends_on: ['test'] },
      { id: 'deploy', tool: 'bash', args: { command: 'npm run deploy' }, depends_on: ['build'] }
    ]
  }
})

// 执行工作流
workflow_execute({ name: 'deploy' })
```

### 3. pi-test-integration (测试框架集成)

集成主流测试框架，支持：
- **框架检测**: 自动识别 Vitest/Jest/Pytest
- **测试运行**: 运行项目测试
- **失败分析**: 分析失败原因并提供修复建议

```javascript
// 运行测试
test_run({ pattern: 'auth.test.ts' })

// 分析失败
test_analyze({
  testName: 'should authenticate',
  error: 'expected 1 to equal 2'
})

// 检测框架
test_framework({})
```

## 使用场景

### 场景 1: 开发新功能

```javascript
// 1. 使用 pi-subagents 的 planner 分解任务
subagent({ agent: 'planner', task: 'Plan: Add user authentication' })

// 2. 使用 workflow 编排开发流程
workflow_load({
  name: 'feature-dev',
  definition: {
    steps: [
      { id: 'implement', tool: 'bash', args: { command: 'npm run dev' } },
      { id: 'test', tool: 'bash', args: { command: 'npm test' }, depends_on: ['implement'] },
      { id: 'review', tool: 'bash', args: { command: 'npm run lint' }, depends_on: ['test'] }
    ]
  }
})

// 3. 使用 loop-engine 自动重试失败
// (自动启用，无需手动配置)
```

### 场景 2: 调试测试失败

```javascript
// 1. 运行测试
test_run({ pattern: 'auth.test.ts' })

// 2. 分析失败
test_analyze({
  testName: 'should authenticate user',
  error: 'TypeError: Cannot read property of undefined'
})

// 3. 修复后重新运行
test_run({ pattern: 'auth.test.ts' })
```

### 场景 3: 复杂工作流

```javascript
// 定义多步骤工作流
workflow_load({
  name: 'ci-cd',
  definition: {
    steps: [
      { id: 'lint', tool: 'bash', args: { command: 'npm run lint' } },
      { id: 'test', tool: 'bash', args: { command: 'npm test' }, depends_on: ['lint'] },
      { id: 'build', tool: 'bash', args: { command: 'npm run build' }, depends_on: ['test'] },
      { id: 'deploy', tool: 'bash', args: { command: 'npm run deploy' }, depends_on: ['build'], condition: 'branch == main' }
    ]
  }
})

// 执行工作流
workflow_execute({ name: 'ci-cd' })
```

## 配置

各扩展配置文件位于扩展目录下的 `config.json`。

### 全局配置示例

```json
{
  "pi-loop-engine": {
    "enabled": true,
    "maxRetries": { "test": 3, "build": 2 }
  },
  "pi-workflow-engine": {
    "enabled": true,
    "maxConcurrentSteps": 4
  },
  "pi-test-integration": {
    "enabled": true,
    "defaultFramework": "auto"
  }
}
```

## 命令

| 命令 | 说明 |
|------|------|
| `/loop-config` | 配置 loop engine |
| `/workflow` | 工作流管理 |
| `/test` | 测试管理 |

## 工具

| 工具 | 说明 |
|------|------|
| `loop_status` | 查看 loop engine 状态 |
| `workflow_load` | 加载工作流 |
| `workflow_execute` | 执行工作流 |
| `workflow_status` | 查看工作流状态 |
| `workflow_parallel` | 并行执行步骤 |
| `workflow_state` | 状态机操作 |
| `test_run` | 运行测试 |
| `test_analyze` | 分析测试失败 |
| `test_framework` | 检测测试框架 |

## 文件结构

```
~/.pi/agent/extensions/
├── pi-loop-engine/
│   ├── index.ts              # 扩展入口
│   ├── branch.ts             # 条件分支
│   ├── loop.ts               # 循环支持
│   ├── persistence.ts        # 状态持久化
│   ├── retry-strategy.ts     # 重试策略
│   ├── detectors.ts          # 失败检测
│   ├── loop-state.ts         # 状态管理
│   ├── context-injector.ts   # 上下文注入
│   ├── config.json           # 配置
│   └── README.md
│
├── pi-workflow-engine/
│   ├── index.ts              # 扩展入口
│   ├── core.ts               # 工作流引擎核心
│   ├── types.ts              # 类型定义
│   ├── parallel.ts           # 并行执行
│   ├── state-machine.ts      # 状态机
│   ├── error-handler.ts      # 错误处理
│   ├── config.json           # 配置
│   └── README.md
│
├── pi-test-integration/
│   ├── index.ts              # 扩展入口
│   ├── types.ts              # 类型定义
│   ├── adapters.ts           # 测试框架适配器
│   ├── analyzer.ts           # 失败分析器
│   ├── config.json           # 配置
│   └── README.md
│
├── integration.test.ts       # 集成测试
└── README.md                 # 本文档
```

## 测试

```bash
# 运行单个扩展测试
cd ~/.pi/agent/extensions/pi-loop-engine && npm test
cd ~/.pi/agent/extensions/pi-workflow-engine && npm test
cd ~/.pi/agent/extensions/pi-test-integration && npm test

# 运行集成测试
cd ~/.pi && npx vitest run .pi/agent/extensions/integration.test.ts
```

## 多代理迁移指南

pi-multi-agent 已移除，功能已迁移至 **pi-subagents**（通过 npm 包安装）。

### 工具映射

| 原 pi-multi-agent | pi-subagents 等效用法 |
|-------------------|---------------------|
| `multi_agent({ agent, task })` | `subagent({ agent, task })` |
| `multi_agent({ tasks: [...] })` | `subagent({ tasks: [...] })` |
| `multi_agent({ steps: [...] })` | `subagent({ chain: [...] })` |
| `multi_agent({ autoTask })` | `subagent({ agent: "planner", task: autoTask })` |
| `agent_list()` | `subagent({ action: "list" })` |
| `task_decompose({ task })` | `subagent({ agent: "planner", task })` |
| `result_aggregate({ results })` | chain 模式自动聚合 |

### pi-subagents 额外能力

- **async 执行**: `subagent({ async: true })`
- **上下文隔离**: `subagent({ context: "fresh" | "fork" })`
- **子代理控制**: `subagent({ action: "interrupt" | "resume" })`
- **8 个工作流模板**: parallel-review, review-loop 等
- **Builtin agents**: scout, worker, reviewer, oracle, planner

## 更新日志

### v1.1.0 (2026-06-11)

- 移除 pi-multi-agent，功能迁移至 pi-subagents
- 添加多代理迁移指南

### v1.0.0 (2026-06-11)

- 初始发布
- pi-loop-engine: 条件分支、循环、状态持久化、重试策略
- pi-workflow-engine: 工作流编排、状态机、并行执行、错误处理
- pi-test-integration: Vitest/Jest/Pytest 支持、失败分析
