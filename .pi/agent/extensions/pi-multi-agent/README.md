# pi-multi-agent

多代理协作扩展，完全覆盖 subagent 扩展的能力，提供更高级的自动化功能。

## 与 subagent 的对比

| 能力 | subagent | pi-multi-agent |
|------|----------|----------------|
| 单个代理 | ✅ | ✅ |
| 并行代理 | ✅ | ✅ |
| 链式代理 | ✅ | ✅ |
| 任务分解 | ❌ | ✅ |
| 智能调度 | ❌ | ✅ |
| 结果聚合 | ❌ | ✅ |
| 自动模式 | ❌ | ✅ |

## 执行模式

### 1. Single 模式（覆盖 subagent）

单个代理执行任务。

```javascript
multi_agent({
  agent: "coder",
  task: "Write hello world",
  cwd: "/project"
})
```

### 2. Parallel 模式（覆盖 subagent）

多个代理并行执行任务。

```javascript
multi_agent({
  tasks: [
    { agent: "coder", task: "Task 1" },
    { agent: "tester", task: "Task 2" },
    { agent: "reviewer", task: "Task 3" }
  ],
  maxConcurrency: 2
})
```

### 3. Chain 模式（覆盖 subagent）

链式执行，支持 `{previous}` 占位符。

```javascript
multi_agent({
  steps: [
    { agent: "coder", task: "Implement feature" },
    { agent: "tester", task: "Test: {previous}" },
    { agent: "reviewer", task: "Review: {previous}" }
  ]
})
```

### 4. Auto 模式（新增）

自动分解任务并执行。

```javascript
multi_agent({
  autoTask: "Build a complete user authentication system",
  decompose: true,
  aggregate: true
})
```

## 工具

### multi_agent

主工具，支持所有执行模式。

```javascript
// Single 模式
multi_agent({ agent: "coder", task: "..." })

// Parallel 模式
multi_agent({ tasks: [...] })

// Chain 模式
multi_agent({ steps: [...] })

// Auto 模式
multi_agent({ autoTask: "..." })
```

### agent_list

列出可用的代理角色。

```javascript
agent_list({})
```

### task_decompose

手动分解任务。

```javascript
task_decompose({ task: "Implement user authentication" })
```

### result_aggregate

手动聚合结果。

```javascript
result_aggregate({
  results: [
    { taskId: "task1", status: "success", output: "..." },
    { taskId: "task2", status: "failure", error: "..." }
  ]
})
```

## 命令

```
/multi-agent list                    # 列出可用代理
/multi-agent decompose <task>        # 分解任务
/multi-agent aggregate               # 聚合结果
```

## 任务分解策略

### CodeModuleStrategy

分解代码实现任务：
1. 设计解决方案
2. 实现代码
3. 编写测试
4. 代码审查

### FeatureStrategy

分解功能特性任务：
1. 定义需求
2. 设计架构
3. 实现功能
4. 测试验证

### TestStrategy

分解测试任务：
1. 规划测试用例
2. 编写单元测试
3. 编写集成测试

## 配置

```json
{
  "enabled": true,
  "maxConcurrent": 4,
  "timeout": 300000,
  "defaultMode": "single",
  "agents": {
    "coder": {
      "capabilities": ["code", "implement"]
    },
    "tester": {
      "capabilities": ["test", "verify"]
    },
    "reviewer": {
      "capabilities": ["review", "analyze"]
    }
  },
  "decomposition": {
    "enabled": true,
    "strategies": ["code-module", "feature", "test"]
  },
  "aggregation": {
    "enabled": true,
    "combineOutputs": true
  }
}
```

## 文件结构

```
pi-multi-agent/
├── index.ts              # 扩展入口
├── types.ts              # 类型定义
├── executor.ts           # 执行器
├── decomposer.ts         # 任务分解器
├── aggregator.ts         # 结果聚合器
├── config.json           # 配置
└── README.md             # 文档
```

## 测试

```bash
npm test
```

测试覆盖：
- 执行器: 9 tests
- 任务分解: 10 tests
- 结果聚合: 6 tests

**总计: 25 tests**

## 迁移指南

从 subagent 迁移到 pi-multi-agent：

### 替换工具调用

```javascript
// 旧: subagent
subagent({ agent: "coder", task: "..." })

// 新: multi_agent
multi_agent({ agent: "coder", task: "..." })
```

### 并行模式

```javascript
// 旧: subagent
subagent({ tasks: [...] })

// 新: multi_agent
multi_agent({ tasks: [...] })
```

### 链式模式

```javascript
// 旧: subagent
subagent({ chain: [...] })

// 新: multi_agent
multi_agent({ steps: [...] })
```
