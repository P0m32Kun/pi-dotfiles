# pi-loop-engine

pi-coding-agent 的迭代重试扩展，支持无人值守的 Loop Engineering 循环。

## 核心功能

| 功能 | 说明 |
|------|------|
| **失败检测与重试** | 检测工具失败并自动重试 |
| **条件分支** | 根据条件选择执行路径 |
| **循环支持** | while/for 循环 |
| **状态持久化** | 断点续传 |
| **VISION.md 机制** | 防止目标漂移 |
| **Hooks 系统** | 循环关键节点注入状态 |
| **自动化触发器** | 按时间/事件触发循环 |
| **安全检查** | 危险命令检测 |

## 工作原理

```
用户请求
  ↓
before_agent_start → 注入 loop 规则到 system prompt（不可跳过）
  ↓
Agent 执行工具 → tool_result hook 检测失败
  ↓
  ├─ 成功 → 继续
  └─ 失败 → 记录 → turn_end 触发重试
                   → context hook 注入失败历史
                   → sendUserMessage 触发新一轮
                   → 达到上限 → escalate 给用户
```

## 核心功能

### 1. 失败检测与重试

| 类别 | 检测方式 | 默认重试次数 |
|------|---------|:----------:|
| test | 测试输出含 FAIL/failed/❌ 等 | 3 |
| build | 编译错误/TS 错误/Cannot find module | 2 |
| lint | eslint/prettier/biome 错误 | 2 |
| runtime | exit code 1/2/126/127/134/137/139 + Error/Exception | 2 |
| edit | edit 工具 old_string not found | 2 |
| custom | 自定义规则 | 1 |

### 2. 条件分支 (新增)

支持根据条件选择不同的执行路径：

```typescript
import { executeBranch } from './branch.js';

const result = await executeBranch({
  condition: 'testPassed',
  truePath: [
    { id: 'deploy', execute: async () => { /* 部署 */ } }
  ],
  falsePath: [
    { id: 'fix', execute: async () => { /* 修复 */ } }
  ],
  context: { testPassed: false }
});
```

**支持的条件格式**：
- 布尔字符串: `'true'` / `'false'`
- 函数谓词: `() => boolean`
- 比较表达式: `'count > 3'`、`'status == "success"'`
- 变量真值: `'isValid'`

### 3. 循环支持 (新增)

#### While 循环

```typescript
import { executeWhileLoop } from './loop.js';

const result = await executeWhileLoop({
  condition: () => counter < 5,
  body: [
    { id: 'step', execute: async (iteration) => { /* 执行 */ } }
  ],
  maxIterations: 100,
  breakCondition: () => shouldStop
});
```

#### For 循环

```typescript
import { executeForLoop } from './loop.js';

const result = await executeForLoop(3, [
  { id: 'step', execute: async (iteration) => { /* 执行 */ } }
]);
```

### 4. 状态持久化 (新增)

支持将循环状态保存到文件，实现断点续传：

```typescript
import { FilePersistence } from './persistence.js';

const persistence = new FilePersistence('.pi/loop-state.json');

// 保存状态
await persistence.save(loopState);

// 加载状态
const state = await persistence.load();
if (state) {
  // 恢复执行
}
```

### 5. 多种重试策略 (新增)

#### 立即重试 (Immediate)

```typescript
import { ImmediateStrategy } from './retry-strategy.js';

const strategy = new ImmediateStrategy({ maxAttempts: 3 });
```

#### 退避重试 (Backoff)

```typescript
import { BackoffStrategy } from './retry-strategy.js';

const strategy = new BackoffStrategy({
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: true  // 避免雷群效应
});
```

#### 自适应重试 (Adaptive)

```typescript
import { AdaptiveStrategy } from './retry-strategy.js';

const strategy = new AdaptiveStrategy({
  maxAttempts: 5,
  baseDelayMs: 1000,
  errorDelays: {
    'rate_limit': 10000,
    'timeout': 5000,
    'default': 1000
  }
});
```

### 6. VISION.md 机制 (新增)

防止目标漂移，确保 AI 始终围绕项目目标工作：

```typescript
import { VisionManagerImpl } from './vision.js';
import { DriftDetectorImpl } from './drift-detector.js';
import { VisionInjectorImpl } from './vision-injector.js';

// 创建 VISION.md
const visionManager = new VisionManagerImpl();
await visionManager.save({
  goals: ['构建高性能 Web 应用'],
  constraints: ['不使用外部依赖'],
  currentPhase: '实现用户认证',
  forbidden: ['修改数据库 schema']
});

// 检测目标漂移
const driftDetector = new DriftDetectorImpl();
const drift = await driftDetector.checkDrift('修改数据库 schema', vision);
if (drift.drifted) {
  console.log('目标漂移:', drift.reason);
}
```

### 7. Hooks 系统 (新增)

在循环关键节点注入状态和检查：

```typescript
import { HookSystemImpl } from './hooks.js';
import { createSecurityCheckHook, createLoggingHook } from './builtin-hooks.js';

const hookSystem = new HookSystemImpl();

// 注册安全检查 Hook
hookSystem.register(createSecurityCheckHook());

// 注册日志 Hook
hookSystem.register(createLoggingHook());

// 执行 Hook
const results = await hookSystem.execute('before_loop', {
  task: '实现用户登录',
  state: loopState
});
```

**内置 Hook 类型：**
- `vision-check` - VISION.md 目标漂移检查
- `security-check` - 危险命令检测
- `state-save` - 状态保存
- `logging` - 日志记录
- `metrics` - 性能指标

### 8. 自动化触发器 (新增)

按时间或事件自动触发循环：

```typescript
import { AutomationTriggerManagerImpl } from './triggers.js';

const triggerManager = new AutomationTriggerManagerImpl();

// 注册 Cron 触发器
triggerManager.register({
  type: 'cron',
  name: 'hourly-check',
  enabled: true,
  config: { schedule: '*/60 * * * *' },
  task: '检查 CI 状态',
  action: async () => {
    // 执行检查
  }
});

// 启动触发器
await triggerManager.start();

// 手动触发
await triggerManager.trigger('hourly-check');
```

## 使用

### 工具: `loop_status`

```javascript
// 查看状态
loop_status({ action: "status" })

// 查看配置
loop_status({ action: "config" })

// 重置状态
loop_status({ action: "reset" })
```

### 命令: `/loop-config`

```
/loop-config                              # 查看当前配置
/loop-config maxRetries.test=5            # 设置测试重试次数
/loop-config enabled=false                # 关闭 loop engine
/loop-config strategy=backoff             # 设置退避策略
/loop-config escalation.action=stop       # 达到上限后停止
/loop-config contextInjection.maxHistoryItems=5  # 注入历史条数
```

## 配置

配置文件: `~/.pi/agent/extensions/pi-loop-engine/config.json`

```json
{
  "enabled": true,
  "maxRetries": {
    "test": 3,
    "build": 2,
    "lint": 2,
    "runtime": 2,
    "edit": 2,
    "custom": 1
  },
  "strategy": "immediate",
  "retryStrategies": {
    "test": {
      "type": "backoff",
      "baseDelayMs": 1000,
      "maxDelayMs": 10000
    },
    "runtime": {
      "type": "adaptive",
      "errorDelays": {
        "timeout": 5000,
        "rate_limit": 10000,
        "default": 1000
      }
    }
  },
  "contextInjection": {
    "includeFailureHistory": true,
    "includePreviousAttempts": true,
    "maxHistoryItems": 3
  },
  "escalation": {
    "action": "ask"
  },
  "persistence": {
    "enabled": false,
    "type": "memory",
    "path": ".pi/loop-state.json"
  },
  "exclude": {
    "tools": [],
    "patterns": []
  }
}
```

### 配置说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `enabled` | boolean | 全局开关 |
| `maxRetries.<category>` | number | 每种失败类型的最大重试次数 |
| `strategy` | string | 全局重试策略: `immediate` / `backoff` / `adaptive` |
| `retryStrategies.<category>` | object | 每种失败类型的特定重试策略 |
| `contextInjection.includeFailureHistory` | boolean | 重试时注入历史失败信息 |
| `contextInjection.maxHistoryItems` | number | 最多注入几条历史 |
| `escalation.action` | string | 达到上限后: `notify` / `ask` / `stop` |
| `persistence.enabled` | boolean | 是否启用状态持久化 |
| `persistence.type` | string | 持久化类型: `memory` / `file` |
| `persistence.path` | string | 文件持久化路径 |
| `exclude.tools` | string[] | 不监控的工具名 |
| `exclude.patterns` | string[] | 不监控的输出模式（正则） |

## 用户体验

### 正常重试

```
用户: 实现用户登录功能
Agent: [写代码] [运行测试]
  ❌ 测试失败
  🔄 Loop Engine: test 失败，第 1/3 次重试
Agent: [分析] [修复] [重跑测试]
  ✅ 测试通过
Agent: 完成！经过 1 次重试后测试全部通过。
```

### 达到上限

```
Agent: [运行测试]
  ❌ 测试失败
  🔄 Loop Engine: test 失败，第 3/3 次重试
Agent: [修复] [测试]
  ❌ 仍然失败
  ⚠️ Loop Engine: 已达重试上限 (3/3)
  ❓ 请决定: 继续重试 / 手动介入 / 放弃
```

## 与 P-Skills 的协作

| 层级 | 负责方 | 内容 |
|------|--------|------|
| 检测失败 | Extension | `tool_result` hook 程序化检测 |
| 决定重试 | Extension | `turn_end` hook 自动触发 |
| 如何修复 | Skill | agent 读取 `tdd`/`fix-bug` skill 的方法论 |
| 注入上下文 | Extension | `context` hook 注入失败信息 |
| 重试上限 | Extension | 配置化，不可跳过 |

## 文件结构

```
pi-loop-engine/
├── index.ts              # 扩展入口（hooks + 注册）
├── detectors.ts          # 失败检测规则
├── loop-state.ts         # 循环状态管理
├── context-injector.ts   # 上下文注入构建
├── branch.ts             # 条件分支支持
├── loop.ts               # 循环支持
├── persistence.ts        # 状态持久化
├── retry-strategy.ts     # 重试策略
├── vision.ts             # VISION.md 管理器
├── drift-detector.ts     # 目标漂移检测
├── vision-injector.ts    # 提示注入
├── hooks.ts              # Hooks 系统
├── builtin-hooks.ts      # 内置 Hook
├── triggers.ts           # 自动化触发器
├── config.json           # 默认配置
└── README.md             # 本文档
```

## 测试

```bash
cd ~/.pi/agent/extensions/pi-loop-engine
npm test
```

测试覆盖：
- 条件分支: 12 个测试
- 循环支持: 9 个测试
- 状态持久化: 9 个测试
- 重试策略: 14 个测试
- VISION.md: 14 个测试
- Hooks 系统: 20 个测试
- 自动化触发器: 6 个测试

**总计: 87 个测试**
