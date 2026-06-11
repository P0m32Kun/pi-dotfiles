# Pi 扩展增强实施计划

## 概述
- **目标**：开发 4 个核心扩展，提升 pi 的自动化和协作能力
- **预计时间**：4-6 周
- **依赖**：现有 pi-loop-engine、agentmemory 扩展

---

## 任务列表

### Phase 1: 增强 pi-loop-engine (Week 1)

#### Task 1.1: 创建条件分支工具
- **目标**：实现 `loop_branch` 工具
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/branch.ts`
- **验收**：REQ-1
- **步骤**：
  1. 创建 `branch.ts` 文件
  2. 定义 `ConditionalBranch` 接口
  3. 实现条件评估函数
  4. 注册 `loop_branch` 工具
  5. 编写单元测试
- **验证**：
  - 运行测试：`vitest run branch.test.ts`
  - 手动测试：在 pi 中调用 `loop_branch` 工具
- **状态**：pending

#### Task 1.2: 创建循环工具
- **目标**：实现 `loop_while` 和 `loop_for` 工具
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/loop.ts`
- **验收**：REQ-2
- **步骤**：
  1. 创建 `loop.ts` 文件
  2. 定义 `LoopConfig` 接口
  3. 实现 while 循环逻辑
  4. 实现 for 循环逻辑
  5. 注册 `loop_while` 和 `loop_for` 工具
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run loop.test.ts`
  - 手动测试：在 pi 中调用循环工具
- **状态**：pending

#### Task 1.3: 实现状态持久化
- **目标**：保存和恢复循环状态
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/persistence.ts`
- **验收**：REQ-3
- **步骤**：
  1. 创建 `persistence.ts` 文件
  2. 定义 `StatePersistence` 接口
  3. 实现文件存储适配器
  4. 实现内存存储适配器
  5. 集成到现有循环逻辑
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run persistence.test.ts`
  - 手动测试：重启 pi 后恢复状态
- **状态**：pending

#### Task 1.4: 增强重试策略
- **目标**：支持多种重试策略
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/retry-strategy.ts`
- **验收**：REQ-4
- **步骤**：
  1. 创建 `retry-strategy.ts` 文件
  2. 定义 `RetryStrategy` 接口
  3. 实现立即重试策略
  4. 实现退避重试策略
  5. 实现自适应重试策略
  6. 集成到现有重试逻辑
  7. 编写单元测试
- **验证**：
  - 运行测试：`vitest run retry-strategy.test.ts`
  - 手动测试：触发失败后观察重试行为
- **状态**：pending

#### Task 1.5: 更新 pi-loop-engine 配置
- **目标**：扩展配置支持新功能
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/config.json`
- **验收**：所有新功能可配置
- **步骤**：
  1. 更新 `config.json` 格式
  2. 添加新配置项文档
  3. 实现配置验证
  4. 编写配置测试
- **验证**：
  - 运行测试：`vitest run config.test.ts`
  - 手动测试：修改配置后观察行为变化
- **状态**：pending

#### Task 1.6: 更新 pi-loop-engine 文档
- **目标**：更新 README 和使用示例
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 更新 README.md
  2. 添加新功能说明
  3. 添加使用示例
  4. 添加配置说明
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

---

### Phase 2: 开发 pi-workflow-engine (Week 2-3)

#### Task 2.1: 创建工作流引擎核心
- **目标**：实现工作流定义解析和执行
- **文件**：`~/.pi/agent/extensions/pi-workflow-engine/core.ts`
- **验收**：REQ-5, REQ-6
- **步骤**：
  1. 创建 `pi-workflow-engine` 目录
  2. 创建 `core.ts` 文件
  3. 定义 `WorkflowDefinition` 接口
  4. 实现 YAML/JSON 解析器
  5. 实现步骤依赖解析
  6. 实现条件执行逻辑
  7. 编写单元测试
- **验证**：
  - 运行测试：`vitest run core.test.ts`
  - 手动测试：加载工作流定义并执行
- **状态**：pending

#### Task 2.2: 实现并行执行
- **目标**：支持并行步骤组
- **文件**：`~/.pi/agent/extensions/pi-workflow-engine/parallel.ts`
- **验收**：REQ-7
- **步骤**：
  1. 创建 `parallel.ts` 文件
  2. 定义 `ParallelGroup` 接口
  3. 实现并行执行器
  4. 实现结果聚合
  5. 实现并发控制
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run parallel.test.ts`
  - 手动测试：执行并行工作流
- **状态**：pending

#### Task 2.3: 实现状态机
- **目标**：支持状态定义和转换
- **文件**：`~/.pi/agent/extensions/pi-workflow-engine/state-machine.ts`
- **验收**：REQ-8
- **步骤**：
  1. 创建 `state-machine.ts` 文件
  2. 定义 `StateDefinition` 接口
  3. 实现状态机引擎
  4. 实现状态持久化
  5. 实现事件触发
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run state-machine.test.ts`
  - 手动测试：触发状态转换
- **状态**：pending

#### Task 2.4: 实现错误处理
- **目标**：支持重试、回滚、降级
- **文件**：`~/.pi/agent/extensions/pi-workflow-engine/error-handler.ts`
- **验收**：REQ-9
- **步骤**：
  1. 创建 `error-handler.ts` 文件
  2. 定义错误处理策略
  3. 实现重试逻辑
  4. 实现回滚逻辑
  5. 实现降级逻辑
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run error-handler.test.ts`
  - 手动测试：触发错误后观察处理行为
- **状态**：pending

#### Task 2.5: 创建 pi-workflow-engine 工具
- **目标**：注册工作流相关工具
- **文件**：`~/.pi/agent/extensions/pi-workflow-engine/tools.ts`
- **验收**：工具可正常调用
- **步骤**：
  1. 创建 `tools.ts` 文件
  2. 注册 `workflow_load` 工具
  3. 注册 `workflow_execute` 工具
  4. 注册 `workflow_status` 工具
  5. 编写工具测试
- **验证**：
  - 运行测试：`vitest run tools.test.ts`
  - 手动测试：在 pi 中调用工作流工具
- **状态**：pending

#### Task 2.6: 创建 pi-workflow-engine 入口
- **目标**：创建扩展入口文件
- **文件**：`~/.pi/agent/extensions/pi-workflow-engine/index.ts`
- **验收**：扩展可正常加载
- **步骤**：
  1. 创建 `index.ts` 文件
  2. 实现扩展初始化
  3. 注册所有工具和命令
  4. 编写集成测试
- **验证**：
  - 运行测试：`vitest run index.test.ts`
  - 手动测试：加载扩展并使用
- **状态**：pending

#### Task 2.7: 创建 pi-workflow-engine 配置
- **目标**：定义扩展配置
- **文件**：`~/.pi/agent/extensions/pi-workflow-engine/config.json`
- **验收**：配置可正常加载
- **步骤**：
  1. 创建 `config.json` 文件
  2. 定义配置 schema
  3. 实现配置验证
  4. 编写配置测试
- **验证**：
  - 运行测试：`vitest run config.test.ts`
  - 手动测试：修改配置后观察行为变化
- **状态**：pending

#### Task 2.8: 创建 pi-workflow-engine 文档
- **目标**：编写完整文档
- **文件**：`~/.pi/agent/extensions/pi-workflow-engine/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 创建 `README.md` 文件
  2. 添加功能说明
  3. 添加工作流定义格式说明
  4. 添加使用示例
  5. 添加配置说明
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

---

### Phase 3: 开发 pi-multi-agent (Week 3-4)

> **设计目标**：完全覆盖 subagent 扩展的能力，同时提供更高级的自动化功能

#### Task 3.1: 创建代理角色管理
- **目标**：定义和管理代理角色
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/roles.ts`
- **验收**：REQ-10
- **步骤**：
  1. 创建 `pi-multi-agent` 目录
  2. 创建 `roles.ts` 文件
  3. 定义 `AgentRole` 接口（包含 source 字段：user/project/builtin）
  4. 实现角色注册和管理
  5. 实现能力匹配
  6. 实现从 subagent 配置迁移
  7. 编写单元测试
- **验证**：
  - 运行测试：`vitest run roles.test.ts`
  - 手动测试：注册角色并查询
- **状态**：pending

#### Task 3.2: 实现执行模式（覆盖 subagent）
- **目标**：实现 single/parallel/chain 执行模式
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/executor.ts`
- **验收**：REQ-20, REQ-21, REQ-22
- **步骤**：
  1. 创建 `executor.ts` 文件
  2. 定义 `MultiAgentExecution` 类型
  3. 实现 `SingleExecutor` - 单个代理执行
  4. 实现 `ParallelExecutor` - 并行代理执行（参考 subagent 实现）
  5. 实现 `ChainExecutor` - 链式代理执行（支持 `{previous}` 占位符）
  6. 实现统一的执行入口 `execute(execution: MultiAgentExecution)`
  7. 复用 subagent 的 `runSingleAgent` 逻辑
  8. 编写单元测试（对比 subagent 的行为）
- **验证**：
  - 运行测试：`vitest run executor.test.ts`
  - 手动测试：执行 single/parallel/chain 模式
  - 兼容性测试：确保行为与 subagent 一致
- **状态**：pending

#### Task 3.3: 实现任务分解
- **目标**：自动将复杂任务拆解为子任务
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/decomposer.ts`
- **验收**：REQ-11, REQ-12, REQ-23
- **步骤**：
  1. 创建 `decomposer.ts` 文件
  2. 定义 `SubTask` 接口（包含 type 字段）
  3. 定义 `DecompositionStrategy` 接口
  4. 实现内置策略：
     - `CodeModuleStrategy` - 按代码模块分解
     - `FeatureStrategy` - 按功能特性分解
     - `TestStrategy` - 按测试用例分解
     - `FileStrategy` - 按文件分解
  5. 实现策略选择器（根据任务描述自动选择策略）
  6. 实现依赖分析
  7. 实现优先级计算
  8. 编写单元测试
- **验证**：
  - 运行测试：`vitest run decomposer.test.ts`
  - 手动测试：分解复杂任务
- **状态**：pending

#### Task 3.4: 实现任务调度
- **目标**：将子任务委派给合适的代理
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/scheduler.ts`
- **验收**：REQ-13
- **步骤**：
  1. 创建 `scheduler.ts` 文件
  2. 定义 `TaskScheduler` 接口
  3. 实现负载均衡算法
  4. 实现任务委派
  5. 实现进度跟踪
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run scheduler.test.ts`
  - 手动测试：调度多个任务
- **状态**：pending

#### Task 3.5: 实现结果聚合
- **目标**：收集和合并子任务结果
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/aggregator.ts`
- **验收**：REQ-14
- **步骤**：
  1. 创建 `aggregator.ts` 文件
  2. 定义 `ResultAggregator` 接口
  3. 实现结果收集
  4. 实现结果合并
  5. 实现摘要生成
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run aggregator.test.ts`
  - 手动测试：聚合多个子任务结果
- **状态**：pending

#### Task 3.6: 创建 pi-multi-agent 工具（覆盖 subagent）
- **目标**：注册多代理相关工具，完全覆盖 subagent 能力
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/tools.ts`
- **验收**：REQ-20, REQ-21, REQ-22, REQ-23
- **步骤**：
  1. 创建 `tools.ts` 文件
  2. 注册 `multi_agent` 工具（主工具，覆盖 subagent）
     - 支持 single 模式：`{ agent, task, cwd? }`
     - 支持 parallel 模式：`{ tasks: [{ agent, task, cwd? }], maxConcurrency? }`
     - 支持 chain 模式：`{ steps: [{ agent, task, cwd? }] }`（支持 `{previous}` 占位符）
     - 支持 auto 模式：`{ task, decompose?, aggregate? }`
  3. 注册 `agent_list` 工具 - 列出可用代理
  4. 注册 `task_decompose` 工具 - 手动分解任务
  5. 注册 `result_aggregate` 工具 - 手动聚合结果
  6. 编写工具测试（对比 subagent 的测试用例）
- **验证**：
  - 运行测试：`vitest run tools.test.ts`
  - 手动测试：在 pi 中调用多代理工具，对比 subagent 行为
  - 兼容性测试：确保现有 subagent 调用可无缝迁移
- **状态**：pending

#### Task 3.7: 创建 pi-multi-agent 入口
- **目标**：创建扩展入口文件
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/index.ts`
- **验收**：扩展可正常加载
- **步骤**：
  1. 创建 `index.ts` 文件
  2. 实现扩展初始化
  3. 注册所有工具和命令
  4. 编写集成测试
- **验证**：
  - 运行测试：`vitest run index.test.ts`
  - 手动测试：加载扩展并使用
- **状态**：pending

#### Task 3.8: 创建 pi-multi-agent 配置
- **目标**：定义扩展配置
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/config.json`
- **验收**：配置可正常加载
- **步骤**：
  1. 创建 `config.json` 文件
  2. 定义配置 schema
  3. 实现配置验证
  4. 编写配置测试
- **验证**：
  - 运行测试：`vitest run config.test.ts`
  - 手动测试：修改配置后观察行为变化
- **状态**：pending

#### Task 3.9: 创建 pi-multi-agent 文档
- **目标**：编写完整文档
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 创建 `README.md` 文件
  2. 添加功能说明（对比 subagent）
  3. 添加角色定义说明
  4. 添加执行模式说明（single/parallel/chain/auto）
  5. 添加使用示例
  6. 添加从 subagent 迁移指南
  7. 添加配置说明
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

---

### Phase 4: 开发 pi-test-integration (Week 4-5)

#### Task 4.1: 创建测试框架适配器
- **目标**：支持多种测试框架
- **文件**：`~/.pi/agent/extensions/pi-test-integration/adapters.ts`
- **验收**：REQ-15
- **步骤**：
  1. 创建 `pi-test-integration` 目录
  2. 创建 `adapters.ts` 文件
  3. 定义 `TestFrameworkAdapter` 接口
  4. 实现 Jest 适配器
  5. 实现 Vitest 适配器
  6. 实现 pytest 适配器
  7. 实现框架自动检测
  8. 编写单元测试
- **验证**：
  - 运行测试：`vitest run adapters.test.ts`
  - 手动测试：检测项目测试框架
- **状态**：pending

#### Task 4.2: 实现测试运行器
- **目标**：运行各种类型的测试
- **文件**：`~/.pi/agent/extensions/pi-test-integration/runner.ts`
- **验收**：REQ-16
- **步骤**：
  1. 创建 `runner.ts` 文件
  2. 定义 `TestRunner` 接口
  3. 实现单元测试运行
  4. 实现集成测试运行
  5. 实现 E2E 测试运行
  6. 实现测试结果解析
  7. 编写单元测试
- **验证**：
  - 运行测试：`vitest run runner.test.ts`
  - 手动测试：运行项目测试
- **状态**：pending

#### Task 4.3: 实现覆盖率分析
- **目标**：生成覆盖率报告
- **文件**：`~/.pi/agent/extensions/pi-test-integration/coverage.ts`
- **验收**：REQ-17
- **步骤**：
  1. 创建 `coverage.ts` 文件
  2. 定义 `CoverageReport` 接口
  3. 实现覆盖率收集
  4. 实现覆盖率解析
  5. 实现报告生成
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run coverage.test.ts`
  - 手动测试：生成覆盖率报告
- **状态**：pending

#### Task 4.4: 实现失败分析
- **目标**：分析测试失败原因
- **文件**：`~/.pi/agent/extensions/pi-test-integration/analyzer.ts`
- **验收**：REQ-18, REQ-19
- **步骤**：
  1. 创建 `analyzer.ts` 文件
  2. 定义 `FailureAnalyzer` 接口
  3. 实现错误解析
  4. 实现根因分析
  5. 实现修复建议生成
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run analyzer.test.ts`
  - 手动测试：分析测试失败
- **状态**：pending

#### Task 4.5: 创建 pi-test-integration 工具
- **目标**：注册测试相关工具
- **文件**：`~/.pi/agent/extensions/pi-test-integration/tools.ts`
- **验收**：工具可正常调用
- **步骤**：
  1. 创建 `tools.ts` 文件
  2. 注册 `test_run` 工具
  3. 注册 `test_coverage` 工具
  4. 注册 `test_analyze` 工具
  5. 编写工具测试
- **验证**：
  - 运行测试：`vitest run tools.test.ts`
  - 手动测试：在 pi 中调用测试工具
- **状态**：pending

#### Task 4.6: 创建 pi-test-integration 入口
- **目标**：创建扩展入口文件
- **文件**：`~/.pi/agent/extensions/pi-test-integration/index.ts`
- **验收**：扩展可正常加载
- **步骤**：
  1. 创建 `index.ts` 文件
  2. 实现扩展初始化
  3. 注册所有工具和命令
  4. 编写集成测试
- **验证**：
  - 运行测试：`vitest run index.test.ts`
  - 手动测试：加载扩展并使用
- **状态**：pending

#### Task 4.7: 创建 pi-test-integration 配置
- **目标**：定义扩展配置
- **文件**：`~/.pi/agent/extensions/pi-test-integration/config.json`
- **验收**：配置可正常加载
- **步骤**：
  1. 创建 `config.json` 文件
  2. 定义配置 schema
  3. 实现配置验证
  4. 编写配置测试
- **验证**：
  - 运行测试：`vitest run config.test.ts`
  - 手动测试：修改配置后观察行为变化
- **状态**：pending

#### Task 4.8: 创建 pi-test-integration 文档
- **目标**：编写完整文档
- **文件**：`~/.pi/agent/extensions/pi-test-integration/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 创建 `README.md` 文件
  2. 添加功能说明
  3. 添加框架支持说明
  4. 添加使用示例
  5. 添加配置说明
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

---

### Phase 5: 集成测试和文档 (Week 5-6)

#### Task 5.1: 集成测试
- **目标**：测试所有扩展的协作
- **文件**：`~/.pi/agent/extensions/integration.test.ts`
- **验收**：所有扩展可正常协作
- **步骤**：
  1. 创建集成测试文件
  2. 测试 pi-loop-engine 与 pi-workflow-engine 集成
  3. 测试 pi-workflow-engine 与 pi-multi-agent 集成
  4. 测试 pi-multi-agent 与 pi-test-integration 集成
  5. 测试所有扩展的完整工作流
- **验证**：
  - 运行测试：`vitest run integration.test.ts`
  - 手动测试：执行完整工作流
- **状态**：pending

#### Task 5.2: 更新主文档
- **目标**：更新 pi 扩展文档
- **文件**：`~/.pi/agent/extensions/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 更新扩展列表
  2. 添加新扩展说明
  3. 添加集成示例
  4. 添加最佳实践
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

#### Task 5.3: 性能优化
- **目标**：优化扩展性能
- **文件**：所有扩展文件
- **验收**：性能达标
- **步骤**：
  1. 分析性能瓶颈
  2. 优化关键路径
  3. 添加缓存机制
  4. 优化内存使用
- **验证**：
  - 运行性能测试
  - 对比优化前后性能
- **状态**：pending

#### Task 5.4: 安全审查
- **目标**：确保扩展安全
- **文件**：所有扩展文件
- **验收**：无安全漏洞
- **步骤**：
  1. 审查代码安全性
  2. 检查依赖安全性
  3. 添加输入验证
  4. 添加错误处理
- **验证**：
  - 运行安全扫描
  - 手动审查关键代码
- **状态**：pending

---

## 依赖关系图

```
Phase 1: pi-loop-engine 增强
    ↓
Phase 2: pi-workflow-engine
    ↓
Phase 3: pi-multi-agent
    ↓
Phase 4: pi-test-integration
    ↓
Phase 5: 集成测试和文档
```

## 风险和缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 技术实现复杂 | 高 | 分阶段实现，先实现核心功能 |
| 集成问题 | 中 | 提早进行集成测试 |
| 性能问题 | 中 | 定期进行性能测试 |
| 安全漏洞 | 高 | 进行安全审查 |

## 完成标准

- [ ] 所有任务已完成
- [ ] 所有测试通过
- [ ] 文档完整且准确
- [ ] 性能达标
- [ ] 安全审查通过
