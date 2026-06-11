# Pi 扩展增强技术规格

## 概述

本文档定义了 4 个核心扩展的技术规格，用于提升 pi-coding-agent 的自动化和协作能力。

---

## 1. pi-loop-engine 增强

### 1.1 接口定义

```typescript
// 新增接口
interface ConditionalBranch {
  condition: string | (() => boolean);
  truePath: Step[];
  falsePath: Step[];
}

interface LoopConfig {
  type: 'while' | 'for' | 'retry';
  condition: string | (() => boolean);
  body: Step[];
  maxIterations?: number;
  breakCondition?: string | (() => boolean);
}

interface StatePersistence {
  save(state: LoopState): Promise<void>;
  load(): Promise<LoopState | null>;
  clear(): Promise<void>;
}

interface RetryStrategy {
  type: 'immediate' | 'backoff' | 'adaptive';
  maxAttempts: number;
  backoffMs?: number;
  shouldRetry: (error: Error, attempt: number) => boolean;
}
```

### 1.2 扩展的配置

```typescript
interface EnhancedLoopConfig extends LoopConfig {
  // 条件分支
  branches?: ConditionalBranch[];
  
  // 循环
  loops?: LoopConfig[];
  
  // 状态持久化
  persistence?: {
    enabled: boolean;
    storage: 'file' | 'memory';
    path?: string;
  };
  
  // 重试策略
  retryStrategies?: Record<FailureCategory, RetryStrategy>;
}
```

### 1.3 新增工具

```typescript
// 新增工具：loop_branch
pi.registerTool({
  name: 'loop_branch',
  description: '根据条件选择执行路径',
  parameters: Type.Object({
    condition: Type.String(),
    trueSteps: Type.Array(StepSchema),
    falseSteps: Type.Array(StepSchema),
  }),
  execute: async (params) => { /* ... */ }
});

// 新增工具：loop_while
pi.registerTool({
  name: 'loop_while',
  description: '执行 while 循环',
  parameters: Type.Object({
    condition: Type.String(),
    body: Type.Array(StepSchema),
    maxIterations: Type.Optional(Type.Number()),
  }),
  execute: async (params) => { /* ... */ }
});
```

### 1.4 验收信号

- REQ-1: 支持条件分支，根据条件选择执行路径
- REQ-2: 支持 while/for 循环，可设置最大迭代次数
- REQ-3: 状态可持久化到文件，支持断点续传
- REQ-4: 支持多种重试策略（立即、退避、自适应）

---

## 2. pi-workflow-engine

### 2.1 工作流定义格式

```yaml
# workflow.yaml
name: code-review-workflow
version: '1.0'
description: 代码审查工作流

steps:
  - id: lint
    name: Lint Check
    tool: bash
    args:
      command: 'npm run lint'
    on_failure: retry
    retry:
      max_attempts: 3
      strategy: immediate

  - id: test
    name: Run Tests
    tool: bash
    args:
      command: 'npm test'
    depends_on: [lint]
    on_failure: stop

  - id: build
    name: Build
    tool: bash
    args:
      command: 'npm run build'
    depends_on: [test]

  - id: deploy
    name: Deploy
    tool: bash
    args:
      command: 'npm run deploy'
    depends_on: [build]
    condition: 'branch == "main"'

parallel:
  - group: quality
    steps: [lint, test]
  
  - group: build-deploy
    steps: [build, deploy]

states:
  - name: idle
    transitions:
      - to: running
        event: start
  
  - name: running
    transitions:
      - to: success
        event: complete
      - to: failed
        event: error
  
  - name: failed
    transitions:
      - to: running
        event: retry
      - to: idle
        event: reset
```

### 2.2 核心接口

```typescript
interface WorkflowDefinition {
  name: string;
  version: string;
  description?: string;
  steps: StepDefinition[];
  parallel?: ParallelGroup[];
  states?: StateDefinition[];
}

interface StepDefinition {
  id: string;
  name: string;
  tool: string;
  args: Record<string, unknown>;
  depends_on?: string[];
  condition?: string;
  on_failure?: 'stop' | 'retry' | 'skip' | 'rollback';
  retry?: RetryConfig;
  rollback?: RollbackConfig;
}

interface ParallelGroup {
  group: string;
  steps: string[];
  max_concurrency?: number;
}

interface StateDefinition {
  name: string;
  transitions: Transition[];
}

interface Transition {
  to: string;
  event: string;
  condition?: string;
}
```

### 2.3 执行引擎

```typescript
interface WorkflowEngine {
  // 加载工作流
  load(definition: WorkflowDefinition): Promise<void>;
  
  // 执行工作流
  execute(context: ExecutionContext): Promise<WorkflowResult>;
  
  // 暂停/恢复
  pause(): Promise<void>;
  resume(): Promise<void>;
  
  // 获取状态
  getState(): WorkflowState;
  
  // 获取历史
  getHistory(): StepResult[];
}
```

### 2.4 验收信号

- REQ-5: 支持 YAML/JSON 工作流定义
- REQ-6: 支持步骤依赖和条件执行
- REQ-7: 支持并行步骤组
- REQ-8: 支持状态机和状态转换
- REQ-9: 支持错误处理（重试、回滚、降级）

---

## 3. pi-multi-agent

### 3.1 代理角色定义

```typescript
interface AgentRole {
  name: string;
  description: string;
  capabilities: string[];
  model?: string;
  tools?: string[];
  systemPrompt?: string;
  source: 'user' | 'project' | 'builtin';
}

interface AgentConfig {
  roles: AgentRole[];
  maxConcurrent?: number;
  timeout?: number;
}
```

### 3.1.1 执行模式（覆盖 subagent）

```typescript
type ExecutionMode = 'single' | 'parallel' | 'chain' | 'auto';

interface SingleExecution {
  mode: 'single';
  agent: string;
  task: string;
  cwd?: string;
}

interface ParallelExecution {
  mode: 'parallel';
  tasks: Array<{
    agent: string;
    task: string;
    cwd?: string;
  }>;
  maxConcurrency?: number;
}

interface ChainExecution {
  mode: 'chain';
  steps: Array<{
    agent: string;
    task: string;  // 支持 {previous} 占位符
    cwd?: string;
  }>;
}

interface AutoExecution {
  mode: 'auto';
  task: string;  // 复杂任务描述
  decompose?: boolean;  // 是否自动分解
  aggregate?: boolean;  // 是否聚合结果
}

type MultiAgentExecution = 
  | SingleExecution
  | ParallelExecution
  | ChainExecution
  | AutoExecution;
```

### 3.2 任务分解

```typescript
interface TaskDecomposer {
  decompose(task: string, context: Context): Promise<SubTask[]>;
}

interface SubTask {
  id: string;
  description: string;
  dependencies: string[];
  assignedTo?: string;
  priority: number;
  estimatedDuration?: number;
  type: 'code' | 'test' | 'review' | 'deploy' | 'other';
}
```

### 3.2.1 智能分解策略

```typescript
interface DecompositionStrategy {
  name: string;
  canHandle(task: string): boolean;
  decompose(task: string, context: Context): Promise<SubTask[]>;
}

// 内置策略
const strategies: DecompositionStrategy[] = [
  new CodeModuleStrategy(),    // 按代码模块分解
  new FeatureStrategy(),       // 按功能特性分解
  new TestStrategy(),          // 按测试用例分解
  new FileStrategy(),          // 按文件分解
];
```

### 3.3 任务调度

```typescript
interface TaskScheduler {
  schedule(tasks: SubTask[], agents: AgentRole[]): Promise<Schedule>;
}

interface Schedule {
  assignments: TaskAssignment[];
  estimatedTotalTime: number;
}

interface TaskAssignment {
  taskId: string;
  agentRole: string;
  startTime: number;
  endTime: number;
}
```

### 3.4 结果聚合

```typescript
interface ResultAggregator {
  aggregate(results: SubTaskResult[]): Promise<FinalResult>;
}

interface SubTaskResult {
  taskId: string;
  status: 'success' | 'failure' | 'skipped';
  output: unknown;
  duration: number;
  error?: string;
}

interface FinalResult {
  status: 'success' | 'partial' | 'failure';
  output: unknown;
  summary: string;
  details: SubTaskResult[];
}
```

### 3.5 验收信号

- REQ-10: 支持定义代理角色和能力
- REQ-11: 支持自动任务分解
- REQ-12: 支持任务依赖分析
- REQ-13: 支持任务委派和负载均衡
- REQ-14: 支持结果聚合和摘要
- REQ-20: 支持单个代理执行（覆盖 subagent single 模式）
- REQ-21: 支持并行代理执行（覆盖 subagent parallel 模式）
- REQ-22: 支持链式代理执行（覆盖 subagent chain 模式）
- REQ-23: 支持自动模式（智能分解 + 执行 + 聚合）

---

## 4. pi-test-integration

### 4.1 测试框架适配器

```typescript
interface TestFrameworkAdapter {
  name: string;
  detect(projectPath: string): Promise<boolean>;
  runTests(options: TestRunOptions): Promise<TestResult>;
  getCoverage(options: CoverageOptions): Promise<CoverageReport>;
}

interface TestRunOptions {
  pattern?: string;
  watch?: boolean;
  bail?: boolean;
  timeout?: number;
  env?: Record<string, string>;
}

interface TestResult {
  status: 'passed' | 'failed' | 'error';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestCase[];
  error?: string;
}

interface TestCase {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  stack?: string;
}
```

### 4.2 覆盖率分析

```typescript
interface CoverageReport {
  total: CoverageSummary;
  files: FileCoverage[];
  timestamp: string;
}

interface CoverageSummary {
  lines: CoverageMetric;
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
}

interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface FileCoverage {
  path: string;
  summary: CoverageSummary;
  uncoveredLines: number[];
}
```

### 4.3 失败分析

```typescript
interface FailureAnalyzer {
  analyze(failure: TestFailure): Promise<FailureAnalysis>;
}

interface TestFailure {
  testName: string;
  error: string;
  stack?: string;
  actual?: unknown;
  expected?: unknown;
}

interface FailureAnalysis {
  rootCause: string;
  suggestion: string;
  relatedFiles: string[];
  similarFailures?: TestFailure[];
}
```

### 4.4 验收信号

- REQ-15: 支持自动检测项目使用的测试框架
- REQ-16: 支持运行单元/集成/E2E 测试
- REQ-17: 支持生成覆盖率报告
- REQ-18: 支持分析测试失败原因
- REQ-19: 支持提供修复建议

---

## 通用约定

### 错误处理

所有扩展应遵循统一的错误处理模式：

```typescript
interface ExtensionError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
  suggestion?: string;
}
```

### 日志规范

```typescript
interface Logger {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, error?: Error, context?: unknown): void;
  debug(message: string, context?: unknown): void;
}
```

### 配置管理

```typescript
interface ConfigManager {
  get<T>(key: string, defaultValue?: T): T;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): void;
}
```
