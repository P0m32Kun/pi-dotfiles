# Pi Coding Agent Configuration

## 语言偏好 / Language Preference

- **始终使用中文（简体）与用户沟通**，包括所有解释、总结和讨论。
- 代码、注释和文档本身可以用英文，但与用户的交互必须用中文。

## Tech Stack

Primary languages and domains:

- **Go** — network tools, CLI utilities, security scanners
- **Rust** — high-performance networking, crypto, parsers
- **Python** — automation scripts, exploit development, data analysis
- **Bash** — glue scripts, CI/CD pipelines, system automation
- **Frontend** — React/Next.js dashboards for security tools

Domain: **Cybersecurity & security tool development** — vulnerability scanners, network analyzers, protocol tools, offensive/defensive tooling.

### Project Conventions

- Prefer stdlib over third-party dependencies when practical
- Network code: always handle timeouts, context cancellation, and connection cleanup
- Security tools: never log secrets/tokens/credentials, always validate input at boundaries
- Error handling: explicit error returns (Go/Rust), exceptions only for truly exceptional cases (Python)
- Testing: security-critical code must have unit tests for edge cases and adversarial inputs

### Documentation Conventions

- **Shared Language (`CONTEXT.md`):** Every project should maintain a `CONTEXT.md` at the repo root (or `CONTEXT-MAP.md` for multi-context repos) documenting the project's domain glossary. When a term is resolved during development, update `CONTEXT.md` inline — don't batch. Use the project's domain vocabulary in all discussions, variable names, and interface design.
- **Architecture Decision Records (`docs/adr/`):** Create ADRs lazily, only when a decision is hard to reverse, surprising without context, and the result of a real trade-off. Record _that_ a decision was made and _why_ — ADRs can be a single paragraph. Number sequentially: `0001-slug.md`.
- **Before coding:** If the request is vague or uses ambiguous domain terms, trigger `grill-with-docs` first to align on terminology, interfaces, and scope.

## Token Optimization

- `rtk` rewrite extension is active — bash commands are automatically rewritten for token savings
- No need to prefix commands with `rtk` manually; the extension handles it
- Check savings: `rtk gain`

### 调试模式下的 Token 策略

当需要查看**完整错误输出**进行调试时（如排查测试失败、编译错误、运行时 panic），使用 `rtk run -c "..."` 执行命令：

- ✅ **保留原始输出格式**，不会被 `rtk` 的类型化过滤器（如测试聚合、构建过滤）破坏
- ✅ **保留完整的堆栈跟踪、错误上下文和行号**
- ⚠️ 仍受 `outputCompaction.truncate.maxChars`（当前 12000）硬性截断，但足以覆盖绝大多数错误场景
- ❌ **不要**手动加 `rtk` 前缀（如 `rtk go test`）—— 这会触发扩展的类型化过滤，丢失关键调试信息

**适用场景**：Bug 修复、测试失败分析、编译/构建错误排查、需要确认完整命令输出的任何调试步骤。

**示例**：

```
# 调试测试失败 — 完整输出
rtk run -c "go test ./... -v 2>&1"

# 调试构建错误 — 完整输出
rtk run -c "cargo build 2>&1"

# 调试 Python 错误 — 完整输出
rtk run -c "pytest -xvs 2>&1"
```

## Behavioral Guidelines

These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 0. 默认对齐 — 未经对齐禁止编码

**对于任何涉及代码修改、功能实现、架构变更的需求，默认必须先执行对齐（align），再进入编码。**

对齐流程：

1. **评估清晰度**：检查请求是否包含接口定义、行为约束、范围边界
2. **执行 grilling**（如需要）：逐条追问，每次只问一个问题，更新 CONTEXT.md
3. **产出对齐报告**：接口定义 + 行为约束 + 验收标准 + 风险
4. **获得确认**：用户明确说"是"、"proceed"、"开始"后才能编码

**跳过对齐的条件（必须全部满足）：**

- 单行或单文件修复，无接口影响
- 行为完全明确（如"修复第42行的off-by-one"）
- 无新域概念、无架构决策
- 用户明确说"fast-track"、"skip align"、"直接修"

**原有的方案先行规则仍然适用**：对齐完成后，仍需提出实施方案并等待用户确认，才能调用工具。

**例外**：纯信息查询（如查看文件、搜索代码、解释概念）不受此限制。

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

### 5. 开发完成标准 / Definition of Done

**编译通过 ≠ 开发完成。** 代码能编译只是最低门槛，不代表功能已实现或可用。

- **端到端测试（E2E）是唯一验收标准。** 一个功能只有在其对应的端到端测试全部通过之后，才能视为开发完成。
- **在 E2E 测试未验证通过前，不允许认为开发任务已完成或向用户报告"已完成"。**
- 开发新功能时，必须同时编写并跑通对应的 E2E 测试用例。测试本身就是需求的一部分，不是事后补充。
- 如果 E2E 测试因环境或依赖问题暂时无法运行，必须明确告知用户并列出剩余验证项，不得默认跳过。

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Subagent 路由规则（强制）

当需要委派任务给 subagent 时，**必须先根据任务类型选择最合适的 specialized agent，禁止无 agent 参数调用**。

### 路由决策表

| 任务特征                                     | 使用 Agent/Chain  | 说明                                                                      |
| -------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| **大型功能**（跨模块、前后端联调、完整流程） | `/dev` chain      | 9 步完整工作流：设计 → 评审 → 并行开发 → 审查 → 简化 → 测试 → 归档 → 推送 |
| **小型改动**（Bug 修复、小重构、配置、文档） | `/quick` chain    | 4 步快速通道：理解 → 实现 → 审查 → 提交                                   |
| **架构决策**（技术选型、方案对比、迁移策略） | `/decision` chain | 3 步决策流：研究 → 评估 → ADR                                             |
| **安全审计**（漏洞扫描、合规检查、安全审查） | `/audit` chain    | 4 步审计流：威胁建模 → 深度审计 → 修复 → 复验                             |
| Go 代码实现（API、服务、业务逻辑）           | `coder`           | 自动加载 golang-pro、golang-testing 等 skill                              |
| 前端代码实现（React、Tauri、UI 组件）        | `coder`           | 自动加载 frontend-ui-engineering、tauri-v2 等 skill                       |
| 代码审查、质量验证                           | `reviewer`        | 自动加载 code-review-and-quality 等 skill                                 |
| 网络研究、技术调研                           | `researcher`      | 独立研究任务                                                              |
| 代码库探索 + 计划制定                        | `explorer`        | 扫描代码库并输出实施计划                                                  |

### 执行方式

**必须显式指定 `agent` 或 `chain`，禁止无 agent 参数的调用。**

```typescript
// ✅ 正确：后端 Go 任务
subagent({ agent: "coder", task: "实现用户认证 API...", context: "fork" });

// ✅ 正确：前端任务
subagent({ agent: "coder", task: "创建登录页面组件...", context: "fork" });

// ✅ 正确：大型功能（完整流程）
subagent({
  chain: "dev-workflow",
  task: "实现文件上传功能...",
  context: "fork",
});

// ✅ 正确：小型改动（快速通道）
subagent({ chain: "quick", task: "修复 goroutine 泄漏...", context: "fork" });

// ✅ 正确：架构决策
subagent({ chain: "decision", task: "选择消息队列方案...", context: "fork" });

// ✅ 正确：安全审计
subagent({ chain: "audit", task: "审计认证模块安全性...", context: "fork" });

// ❌ 错误：无 agent 参数调用
subagent({ task: "修复这个 bug..." });

// ❌ 错误：skill 不是 subagent 的参数
subagent({ skill: "implement-with-review", task: "..." });
```

### 强制 Skill 加载

当用户请求满足以下条件时，**必须**先加载对应的 skill，然后按 skill 工作流委派给正确的 agent。

| 场景                                              | 强制 Skill                | 触发后路由                                  |
| ------------------------------------------------- | ------------------------- | ------------------------------------------- |
| 实现、修复、重构任何代码                          | `implement-with-review`   | 按上表路由到 coder / reviewer / chain 等    |
| 多模块/跨层大型开发任务，可拆分为独立切片并行执行 | `parallel-implementation` | 自动分析 → 并行 worktree 执行 → 合并 → 审查 |
| 架构决策、技术选型                                | `oracle-consult`          | oracle → coder                              |
| 探索代码库、制定计划                              | `recon-and-plan`          | explorer → coder                            |
| 集成新库/框架/API                                 | `research-and-implement`  | researcher → coder                          |

**执行方式**：

1. 先用 `read` 加载对应 SKILL.md
2. 按 skill 指示，通过 `subagent({ agent: "..." })` 或 `subagent({ chain: "..." })` 委派
3. 禁止直接内联实现，禁止绕过 skill 的 agent 路由规则

## Skill 使用指南

当前可用 skills 共 25 个，按优先级和场景分类如下。加载 skill 前先判断场景，避免加载不相关的 skill 浪费 token。

### Tier 1: 核心工作流（优先加载）

| Skill                     | 使用场景                                                   | 与 Agent 的关系                                                                |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `align`                   | 编码前强制对齐：评估清晰度、grilling 会话、更新 CONTEXT.md | 默认前置步骤，可被 `implement-with-review` / `dev-workflow` / `quick` 自动加载 |
| `implement-with-review`   | 任何代码实现、修复、重构                                   | 主 agent 读取后，按路由规则委派给 coder/reviewer/chain                         |
| `parallel-implementation` | 多模块/跨层开发任务，自动并行拆分与调度                    | 主 agent 分析后，并行 dispatch 多个子 agent（worktree 隔离），再合并审查       |
| `oracle-consult`          | 架构决策、技术选型、重大变更                               | 委派给 oracle → coder                                                          |
| `recon-and-plan`          | 探索代码库、制定实施计划                                   | 委派给 explorer                                                                |
| `research-and-implement`  | 集成新库/框架/API、需要外部知识                            | 委派给 researcher → 按领域路由实现                                             |

### Tier 2: 技术领域（按任务类型加载）

| Skill                     | 使用场景                            | 通常由谁加载                |
| ------------------------- | ----------------------------------- | --------------------------- |
| `golang-pro`              | Go 并发、微服务、gRPC、channel 模式 | coder（Go 任务时自动加载）  |
| `golang-testing`          | Go 表驱动测试、benchmark、fuzzing   | coder / reviewer            |
| `golang-performance`      | Go 性能优化、pprof、内存布局        | coder（性能瓶颈时）         |
| `rust-async-patterns`     | Rust async/await、Tokio、并发模式   | oracle（Rust 相关决策时）   |
| `tauri-v2`                | Tauri v2 配置、command、权限、IPC   | coder（前端任务时自动加载） |
| `tailwind-design-system`  | Tailwind v4、设计令牌、组件库       | coder（前端任务时自动加载） |
| `frontend-ui-engineering` | React/TS 组件架构、状态管理、布局   | coder（前端任务时自动加载） |
| `security-and-hardening`  | 输入验证、auth、加密、漏洞防护      | coder / /audit chain        |
| `playwright-e2e-testing`  | E2E 测试、跨浏览器自动化            | reviewer（前端测试时）      |

### Tier 3: 质量保障（按需加载）

| Skill                          | 使用场景                                       | 注意                                                                                 |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `test-driven-development`      | 写测试驱动实现、bug 修复先写失败测试           | 与 `golang-testing` 互补，TDD 是方法论，后者是 Go 具体模式                           |
| `code-review-and-quality`      | 多维度代码审查（正确性/可读性/架构/安全/性能） | 比 `implement-with-review` 的 review 环节更专业，关键 PR 使用                        |
| `code-simplification`          | 代码可读性重构、消除过度工程                   | 不改变行为，只改善清晰度                                                             |
| `debugging-and-error-recovery` | 测试失败、构建中断、行为不符合预期             | 系统性根因分析，不是猜                                                               |
| `diagnose`                     | 复杂 bug / 性能回归的深度调试（6 阶段循环）    | 构建反馈循环 → 假设 → 仪器 → 修复 → 回归测试。比 `debugging-and-error-recovery` 更深 |
| `zoom-out`                     | 修改代码前先看系统全貌                         | 防止局部修改引发全局问题。使用 LSP 导航模块依赖图                                    |
| `source-driven-development`    | 已知框架的具体 API 用法需要查官方文档验证版本  | ⚠️ 与 `research-and-implement` 区分：前者查已知框架的文档，后者调研未知领域          |

### 易混淆 Skill 区分

**`research-and-implement` vs `source-driven-development`**

- `research-and-implement`："我要集成一个新的 OAuth2 库，先研究一下哪家最好" → 网络调研 + 实现
- `source-driven-development`："我要用 React 19 的 useActionState，但不确定新 API 签名" → 查官方文档验证版本

**`implement-with-review` vs `parallel-implementation`**

- `implement-with-review`：串行工作流，适合小到中型任务或高度耦合的代码变更。单 coder 实现 → 单 reviewer 审查。
- `parallel-implementation`：并行工作流，适合多模块/跨层的大型任务。自动分析可拆分性 → worktree 隔离并行开发 → 合并 → 并行审查。当任务涉及 ≥3 个独立文件/模块或前后端联调时优先使用。

**`implement-with-review` vs `code-review-and-quality`**

- `implement-with-review`：执行工作流（实现 + 基础审查），审查是流程的一部分
- `code-review-and-quality`：专业审查工具，五维度深度审查（正确性/可读性/架构/安全/性能），用于关键变更的独立审查

**`test-driven-development` vs `golang-testing`**

- `test-driven-development`：先写失败测试再实现的方法论（RED-GREEN-REFACTOR）
- `golang-testing`：Go 语言的具体测试技术（table-driven、subtest、benchmark、fuzzing）

### Tier 4: 工具技能（偶尔使用）

| Skill                 | 使用场景                                                       |
| --------------------- | -------------------------------------------------------------- |
| `agent-browser`       | 浏览器自动化、网页测试、数据抓取、Electron 应用                |
| `cap-commit-push`     | 快速 `git add + commit + push`                                 |
| `contextdb-autopilot` | 跨 CLI 工具的上下文持久化（Codex/Claude Code/Gemini/opencode） |
| `find-skills`         | 发现新的可用 skills                                            |
| `skill-creator`       | 创建、修改、评估 skills                                        |
| `llm-wiki-bootstrap`  | 初始化 LLM 知识库（Karpathy 模式），项目长期记忆               |
| `harness-init-runner` | 初始化 Node.js agent harness，用于开发 pi 扩展或 TS 项目       |

## Skill 管理原则

### 验证驱动进化

**原则：先观察后增强，不好则剔除。** 技能系统不是"越多越好"。每个新技能必须经过真实场景的验证，证明它能减少返工或提升质量，才能保留。

当前观察期：2026-05-02 起，2-4 周。重点观察 `align` skill 的返工减少效果。

### 评审三问

每次评估一个 skill 时问自己：

1. **这个 skill 本月被触发过吗？**（没触发 → 考虑归档）
2. **触发后产出质量如何？**（质量差 → 重写或删除）
3. **是否有其他 skill 可以替代它？**（可替代 → 合并）

### 精简目标

- 当前：**32 个 skill**（含本轮新增的 `align`、`diagnose`、`zoom-out`、`grill-with-docs`）
- 目标：**< 25 个**
- 观察期后候选淘汰：`harness-init-runner`、`proactive-compaction`、`agent-browser`、`research-and-implement`
- 候选合并：`debugging-and-error-recovery` + `diagnose`、`oracle-consult` + `align`

### Skill 变更流程

1. **新增/增强**：先写 `docs/skill-evolution.md` 变更计划 → 用户确认 → 实施 → 记录到执行记录
2. **归档**：移动到 `.agents/skills/.archived/` → 在 CLAUDE.md 中记录原因 → 更新 `docs/skill-evolution.md`
3. **合并**：保留质量更高的版本 → 将被合并版本归档 → 更新引用

---

### 已移除的 Skills（归档在 ~/.agents/skills/.archived/）

| Skill                        | 移除原因                                                 |
| ---------------------------- | -------------------------------------------------------- |
| `browser-use`                | 被 `agent-browser` 完全覆盖（Rust CLI 更现代、功能更强） |
| `search-first`               | 被 `research-and-implement` 覆盖                         |
| `incremental-implementation` | 合并到 `implement-with-review`（增量切片策略已整合）     |
| `skill-constraints`          | 约束已直接写入 CLAUDE.md，无需独立 skill                 |
