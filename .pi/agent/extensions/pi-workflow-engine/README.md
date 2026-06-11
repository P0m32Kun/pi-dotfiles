# pi-workflow-engine

工作流编排扩展，支持复杂的步骤依赖、条件执行、并行处理和状态机。

## 核心功能

### 1. 工作流定义

支持 YAML/JSON 格式的工作流定义：

```json
{
  "name": "code-review",
  "version": "1.0",
  "steps": [
    {
      "id": "lint",
      "name": "Lint Check",
      "tool": "bash",
      "args": { "command": "npm run lint" },
      "on_failure": "retry",
      "retry": { "max_attempts": 3 }
    },
    {
      "id": "test",
      "name": "Run Tests",
      "tool": "bash",
      "args": { "command": "npm test" },
      "depends_on": ["lint"]
    },
    {
      "id": "build",
      "name": "Build",
      "tool": "bash",
      "args": { "command": "npm run build" },
      "depends_on": ["test"],
      "condition": "branch == main"
    }
  ],
  "parallel": [
    {
      "group": "quality",
      "steps": ["lint", "test"],
      "max_concurrency": 2
    }
  ]
}
```

### 2. 步骤依赖

- `depends_on`: 指定前置步骤
- 自动解析执行顺序
- 支持循环依赖检测

### 3. 条件执行

- `condition`: 条件表达式
- 支持变量引用和比较
- 条件为 false 时跳过步骤

### 4. 并行执行

- 支持并行步骤组
- 可配置最大并发数
- 自动收集结果

### 5. 状态机

```json
{
  "states": [
    { "name": "idle", "transitions": [{ "to": "running", "event": "start" }] },
    { "name": "running", "transitions": [{ "to": "completed", "event": "finish" }] },
    { "name": "completed", "transitions": [] }
  ],
  "initial_state": "idle"
}
```

### 6. 错误处理

| 策略 | 说明 |
|------|------|
| `stop` | 停止执行 |
| `retry` | 重试步骤 |
| `skip` | 跳过步骤 |
| `rollback` | 回滚操作 |
| `fallback` | 使用备用方案 |

## 工具

### workflow_load

加载工作流定义。

```javascript
workflow_load({
  name: "my-workflow",
  definition: { /* 工作流定义 */ }
})
```

### workflow_execute

执行已加载的工作流。

```javascript
workflow_execute({
  name: "my-workflow",
  context: { branch: "main" }
})
```

### workflow_status

查看工作流状态。

```javascript
workflow_status({ name: "my-workflow" })
```

### workflow_parallel

并行执行多个步骤。

```javascript
workflow_parallel({
  steps: [
    { id: "step1", tool: "bash", args: { command: "echo 1" } },
    { id: "step2", tool: "bash", args: { command: "echo 2" } }
  ],
  maxConcurrency: 2
})
```

### workflow_state

状态机操作。

```javascript
// 查看状态
workflow_state({ action: "status" })

// 触发事件
workflow_state({ action: "trigger", event: "start" })

// 查看历史
workflow_state({ action: "history" })
```

## 命令

```
/workflow list      # 列出已加载的工作流
/workflow status    # 查看当前状态
/workflow load      # 加载工作流
/workflow execute   # 执行工作流
```

## 配置

```json
{
  "enabled": true,
  "maxConcurrentSteps": 4,
  "defaultRetry": {
    "maxAttempts": 3,
    "strategy": "immediate"
  },
  "stateMachine": {
    "enabled": true,
    "persistState": false
  },
  "errorHandling": {
    "defaultStrategy": "stop"
  }
}
```

## 文件结构

```
pi-workflow-engine/
├── index.ts              # 扩展入口
├── core.ts               # 工作流引擎核心
├── types.ts              # 类型定义
├── parallel.ts           # 并行执行
├── state-machine.ts      # 状态机
├── error-handler.ts      # 错误处理
├── config.json           # 配置
└── README.md             # 文档
```

## 测试

```bash
npm test
```

测试覆盖：
- 核心引擎: 14 tests
- 并行执行: 7 tests
- 状态机: 18 tests
- 错误处理: 11 tests

**总计: 50 tests**
