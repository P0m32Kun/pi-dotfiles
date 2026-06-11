# Loop Engineering 增强实施计划

## 概述
- **目标**：实现 Loop Engineering 核心组件，支持无人值守 AI 自动开发循环
- **预计时间**：3-4 周
- **依赖**：现有 pi-loop-engine、agentmemory 扩展

---

## 任务列表

### Phase 1: VISION.md 机制 (Week 1)

#### Task 1.1: 创建 VISION.md 管理器
- **目标**：实现 VISION.md 文件的加载、解析和保存
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/vision.ts`
- **验收**：REQ-V1
- **步骤**：
  1. 创建 `vision.ts` 文件
  2. 定义 `Vision` 接口
  3. 实现 `VisionManager` 类
  4. 实现文件加载和解析
  5. 实现文件保存
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run vision.test.ts`
  - 手动测试：创建 VISION.md 并加载
- **状态**：pending

#### Task 1.2: 实现目标漂移检测
- **目标**：检测当前任务是否偏离项目目标
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/drift-detector.ts`
- **验收**：REQ-V2
- **步骤**：
  1. 创建 `drift-detector.ts` 文件
  2. 实现禁止事项检查
  3. 实现约束条件检查
  4. 实现阶段检查
  5. 返回漂移结果
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run drift-detector.test.ts`
  - 手动测试：输入偏离任务，检测漂移
- **状态**：pending

#### Task 1.3: 实现提示注入
- **目标**：将 VISION.md 内容注入到系统提示
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/vision-injector.ts`
- **验收**：REQ-V3
- **步骤**：
  1. 创建 `vision-injector.ts` 文件
  2. 实现 `injectToPrompt` 方法
  3. 格式化 VISION.md 内容
  4. 注入到 before_agent_start hook
  5. 编写单元测试
- **验证**：
  - 运行测试：`vitest run vision-injector.test.ts`
  - 手动测试：检查系统提示是否包含 VISION.md 内容
- **状态**：pending

#### Task 1.4: 集成到 pi-loop-engine
- **目标**：将 VISION.md 机制集成到现有扩展
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/index.ts`
- **验收**：所有新功能可正常工作
- **步骤**：
  1. 更新 `index.ts` 文件
  2. 注册 VISION.md 相关工具
  3. 注册 VISION.md 相关命令
  4. 添加 before_loop hook 检查漂移
  5. 编写集成测试
- **验证**：
  - 运行测试：`vitest run index.test.ts`
  - 手动测试：使用 VISION.md 功能
- **状态**：pending

#### Task 1.5: 更新文档
- **目标**：更新 README 和使用示例
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 更新 README.md
  2. 添加 VISION.md 说明
  3. 添加使用示例
  4. 添加配置说明
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

---

### Phase 2: Hooks 系统 (Week 1-2)

#### Task 2.1: 创建 Hook 系统核心
- **目标**：实现 Hook 注册、执行和管理
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/hooks.ts`
- **验收**：REQ-H1
- **步骤**：
  1. 创建 `hooks.ts` 文件
  2. 定义 `Hook`、`HookContext`、`HookResult` 接口
  3. 实现 `HookSystem` 类
  4. 实现 Hook 注册和注销
  5. 实现 Hook 执行
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run hooks.test.ts`
  - 手动测试：注册和执行 Hook
- **状态**：pending

#### Task 2.2: 实现内置 Hook
- **目标**：实现常用内置 Hook
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/builtin-hooks.ts`
- **验收**：REQ-H2
- **步骤**：
  1. 创建 `builtin-hooks.ts` 文件
  2. 实现 VISION.md 检查 Hook
  3. 实现安全检查 Hook
  4. 实现状态保存 Hook
  5. 实现日志记录 Hook
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run builtin-hooks.test.ts`
  - 手动测试：触发内置 Hook
- **状态**：pending

#### Task 2.3: 集成到 pi-loop-engine
- **目标**：将 Hooks 系统集成到现有扩展
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/index.ts`
- **验收**：所有新功能可正常工作
- **步骤**：
  1. 更新 `index.ts` 文件
  2. 注册 Hook 相关工具
  3. 注册 Hook 相关命令
  4. 在循环关键节点执行 Hook
  5. 编写集成测试
- **验证**：
  - 运行测试：`vitest run index.test.ts`
  - 手动测试：使用 Hooks 功能
- **状态**：pending

#### Task 2.4: 更新文档
- **目标**：更新 README 和使用示例
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 更新 README.md
  2. 添加 Hooks 系统说明
  3. 添加使用示例
  4. 添加配置说明
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

---

### Phase 3: 自动化触发器 (Week 2)

#### Task 3.1: 创建触发器管理器
- **目标**：实现触发器注册、执行和管理
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/triggers.ts`
- **验收**：REQ-T1
- **步骤**：
  1. 创建 `triggers.ts` 文件
  2. 定义 `TriggerConfig`、`TriggerResult` 接口
  3. 实现 `AutomationTriggerManager` 类
  4. 实现触发器注册和注销
  5. 实现触发器启停
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run triggers.test.ts`
  - 手动测试：注册和触发触发器
- **状态**：pending

#### Task 3.2: 实现 Cron 触发器
- **目标**：支持定时触发循环
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/cron-trigger.ts`
- **验收**：REQ-T2
- **步骤**：
  1. 创建 `cron-trigger.ts` 文件
  2. 实现 Cron 表达式解析
  3. 实现定时执行
  4. 支持停止条件
  5. 编写单元测试
- **验证**：
  - 运行测试：`vitest run cron-trigger.test.ts`
  - 手动测试：设置 Cron 触发器
- **状态**：pending

#### Task 3.3: 实现事件触发器
- **目标**：支持事件触发循环
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/event-trigger.ts`
- **验收**：REQ-T3
- **步骤**：
  1. 创建 `event-trigger.ts` 文件
  2. 实现 Git 事件监控
  3. 实现 GitHub Webhook 接收
  4. 实现 Issue 监控
  5. 编写单元测试
- **验证**：
  - 运行测试：`vitest run event-trigger.test.ts`
  - 手动测试：触发事件
- **状态**：pending

#### Task 3.4: 实现文件监控触发器
- **目标**：支持文件变化触发循环
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/file-trigger.ts`
- **验收**：REQ-T4
- **步骤**：
  1. 创建 `file-trigger.ts` 文件
  2. 实现文件监控
  3. 支持路径和模式匹配
  4. 支持防抖
  5. 编写单元测试
- **验证**：
  - 运行测试：`vitest run file-trigger.test.ts`
  - 手动测试：修改文件触发
- **状态**：pending

#### Task 3.5: 集成到 pi-loop-engine
- **目标**：将自动化触发器集成到现有扩展
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/index.ts`
- **验收**：所有新功能可正常工作
- **步骤**：
  1. 更新 `index.ts` 文件
  2. 注册触发器相关工具
  3. 注册触发器相关命令
  4. 启动触发器管理器
  5. 编写集成测试
- **验证**：
  - 运行测试：`vitest run index.test.ts`
  - 手动测试：使用自动化触发器
- **状态**：pending

#### Task 3.6: 更新文档
- **目标**：更新 README 和使用示例
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 更新 README.md
  2. 添加自动化触发器说明
  3. 添加使用示例
  4. 添加配置说明
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

---

### Phase 4: Git Worktrees 隔离 (Week 2-3)

#### Task 4.1: 创建 Worktree 管理器
- **目标**：实现 Git Worktree 的创建、清理和管理
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/worktree.ts`
- **验收**：REQ-W1
- **步骤**：
  1. 创建 `worktree.ts` 文件
  2. 定义 `Worktree`、`WorktreeManager` 接口
  3. 实现 `GitWorktreeManager` 类
  4. 实现 Worktree 创建
  5. 实现 Worktree 清理
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run worktree.test.ts`
  - 手动测试：创建和清理 Worktree
- **状态**：pending

#### Task 4.2: 实现分支管理
- **目标**：支持分支创建和合并
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/worktree.ts`
- **验收**：REQ-W2
- **步骤**：
  1. 实现分支创建
  2. 实现分支合并
  3. 实现冲突检测
  4. 实现状态查询
  5. 编写单元测试
- **验证**：
  - 运行测试：`vitest run worktree.test.ts`
  - 手动测试：创建分支并合并
- **状态**：pending

#### Task 4.3: 集成到 pi-multi-agent
- **目标**：将 Git Worktrees 集成到多代理扩展
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/index.ts`
- **验收**：所有新功能可正常工作
- **步骤**：
  1. 更新 `index.ts` 文件
  2. 注册 Worktree 相关工具
  3. 在并行执行时使用 Worktree
  4. 编写集成测试
- **验证**：
  - 运行测试：`vitest run index.test.ts`
  - 手动测试：并行执行时使用 Worktree
- **状态**：pending

#### Task 4.4: 更新文档
- **目标**：更新 README 和使用示例
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 更新 README.md
  2. 添加 Git Worktrees 说明
  3. 添加使用示例
  4. 添加配置说明
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

---

### Phase 5: 对抗验证 (Week 3)

#### Task 5.1: 创建对抗验证器
- **目标**：实现对抗验证流程
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/adversarial.ts`
- **验收**：REQ-A1
- **步骤**：
  1. 创建 `adversarial.ts` 文件
  2. 定义 `Agent`、`Finding`、`ValidationResult` 接口
  3. 实现 `AdversarialValidator` 类
  4. 实现生成代理
  5. 实现审查代理
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run adversarial.test.ts`
  - 手动测试：执行对抗验证
- **状态**：pending

#### Task 5.2: 实现审查解析
- **目标**：解析审查结果，提取问题
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/adversarial.ts`
- **验收**：REQ-A2
- **步骤**：
  1. 实现审查结果解析
  2. 提取问题分类
  3. 提取严重程度
  4. 提取修复建议
  5. 编写单元测试
- **验证**：
  - 运行测试：`vitest run adversarial.test.ts`
  - 手动测试：解析审查结果
- **状态**：pending

#### Task 5.3: 集成到 pi-multi-agent
- **目标**：将对抗验证集成到多代理扩展
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/index.ts`
- **验收**：所有新功能可正常工作
- **步骤**：
  1. 更新 `index.ts` 文件
  2. 注册对抗验证工具
  3. 支持自动对抗验证模式
  4. 编写集成测试
- **验证**：
  - 运行测试：`vitest run index.test.ts`
  - 手动测试：使用对抗验证
- **状态**：pending

#### Task 5.4: 更新文档
- **目标**：更新 README 和使用示例
- **文件**：`~/.pi/agent/extensions/pi-multi-agent/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 更新 README.md
  2. 添加对抗验证说明
  3. 添加使用示例
  4. 添加配置说明
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

---

### Phase 6: 安全审计 (Week 3-4)

#### Task 6.1: 创建安全审计器
- **目标**：实现安全审计功能
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/security.ts`
- **验收**：REQ-S1
- **步骤**：
  1. 创建 `security.ts` 文件
  2. 定义 `SecurityAuditor` 接口
  3. 实现 `SecurityAuditorImpl` 类
  4. 实现 SAST 扫描
  5. 实现凭证检测
  6. 编写单元测试
- **验证**：
  - 运行测试：`vitest run security.test.ts`
  - 手动测试：扫描代码
- **状态**：pending

#### Task 6.2: 实现命令安全检查
- **目标**：检查命令是否安全
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/security.ts`
- **验收**：REQ-S2
- **步骤**：
  1. 实现危险命令检测
  2. 实现 sudo 检测
  3. 实现网络请求检测
  4. 实现文件删除检测
  5. 编写单元测试
- **验证**：
  - 运行测试：`vitest run security.test.ts`
  - 手动测试：检查命令安全性
- **状态**：pending

#### Task 6.3: 实现日志脱敏
- **目标**：脱敏日志中的敏感信息
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/security.ts`
- **验收**：REQ-S3
- **步骤**：
  1. 实现邮箱脱敏
  2. 实现 IP 地址脱敏
  3. 实现凭证脱敏
  4. 实现自定义模式脱敏
  5. 编写单元测试
- **验证**：
  - 运行测试：`vitest run security.test.ts`
  - 手动测试：脱敏日志
- **状态**：pending

#### Task 6.4: 集成到 pi-loop-engine
- **目标**：将安全审计集成到现有扩展
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/index.ts`
- **验收**：所有新功能可正常工作
- **步骤**：
  1. 更新 `index.ts` 文件
  2. 注册安全审计工具
  3. 注册安全检查 Hook
  4. 编写集成测试
- **验证**：
  - 运行测试：`vitest run index.test.ts`
  - 手动测试：使用安全审计
- **状态**：pending

#### Task 6.5: 更新文档
- **目标**：更新 README 和使用示例
- **文件**：`~/.pi/agent/extensions/pi-loop-engine/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 更新 README.md
  2. 添加安全审计说明
  3. 添加使用示例
  4. 添加配置说明
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

---

### Phase 7: 集成测试和文档 (Week 4)

#### Task 7.1: 集成测试
- **目标**：测试所有新功能的协作
- **文件**：`~/.pi/agent/extensions/integration-v2.test.ts`
- **验收**：所有新功能可正常协作
- **步骤**：
  1. 创建集成测试文件
  2. 测试 VISION.md + Hooks 集成
  3. 测试 Hooks + 触发器集成
  4. 测试触发器 + Worktree 集成
  5. 测试对抗验证 + 安全审计集成
  6. 测试完整循环流程
- **验证**：
  - 运行测试：`vitest run integration-v2.test.ts`
  - 手动测试：执行完整循环
- **状态**：pending

#### Task 7.2: 更新主文档
- **目标**：更新 pi 扩展主文档
- **文件**：`~/.pi/agent/extensions/README.md`
- **验收**：文档完整且准确
- **步骤**：
  1. 更新扩展列表
  2. 添加新功能说明
  3. 添加集成示例
  4. 添加最佳实践
- **验证**：
  - 阅读文档，确认无遗漏
  - 按照文档操作，确认可行
- **状态**：pending

#### Task 7.3: 性能优化
- **目标**：优化新功能性能
- **文件**：所有新文件
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

#### Task 7.4: 安全审查
- **目标**：确保新功能安全
- **文件**：所有新文件
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
Phase 1: VISION.md 机制
    ↓
Phase 2: Hooks 系统
    ↓
Phase 3: 自动化触发器
    ↓
Phase 4: Git Worktrees 隔离
    ↓
Phase 5: 对抗验证
    ↓
Phase 6: 安全审计
    ↓
Phase 7: 集成测试和文档
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
