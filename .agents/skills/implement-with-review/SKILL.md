---
name: implement-with-review
description: |
  Delegates implementation to a specialized subagent and validates with an independent reviewer. ALWAYS runs align first — no code is written until agent and user share a precise understanding. Use when the user asks to implement, add, create, write, build, fix, refactor, or add tests for any code. Use for all coding tasks unless the user explicitly says "fast-track" or "skip align".
---

# Implement With Review

Delegate implementation to the most appropriate specialized subagent, then validate with a reviewer subagent.

## When This Triggers

- User asks to "implement", "add", "create", "write", "build" any code
- User asks to "fix", "patch", "correct" a bug or issue
- User asks to "refactor", "restructure", "clean up" code
- User asks to "add tests" or "write tests" for something
- Any task that involves editing or creating source files

**Alignment is mandatory.** Before any code is written, execute alignment using the `align` skill. The only exceptions are fast-track tasks that meet ALL of these criteria:

- One-line or single-file fix with no interface impact
- Unambiguous desired behavior
- No new domain concepts
- No architectural decisions
- User explicitly says "fast-track", "skip align", or "just fix it"

## Agent Routing Rules（强制执行）

**在执行任何代码任务前，必须先分析任务类型，选择最匹配的 specialized agent。禁止默认使用 `worker`。**

选择流程：

1. 分析用户任务涉及的领域（前端/后端/安全/架构等）
2. 匹配下表中的规则
3. 使用 `subagent({ agent: "..." })` 或 `subagent({ chain: "..." })` 显式调用
4. **禁止**不带 `agent`/`chain` 参数的 `subagent` 调用
5. **禁止**使用 `subagent({ skill: "..." })` — `skill` 不是有效参数

| If task mentions...                                                                  | Use agent              | Notes                                                                  |
| ------------------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------- |
| frontend, UI, React, Tauri, CSS, component, page, layout, Tailwind, 前端, 界面, 组件 | `worker`               | Loads frontend-ui-engineering, tauri-v2, tailwind-design-system skills |
| backend, Go, API, database, service, goroutine, channel, 后端, 数据库                | `worker`               | Loads golang-pro, golang-testing, golang-performance skills            |
| Both frontend AND backend, new feature, 功能开发, 新功能                             | `feature-dev` chain    | Runs full chain: tech-advisor → worker + worker → reviewer             |
| security, audit, vulnerability, auth, 安全, 漏洞                                     | `security-audit` chain | Security-focused audit workflow                                        |
| bug, fix, crash, error, broken, 修复, 调试                                           | `bug-fix` chain        | Systematic reproduce → diagnose → fix → verify                         |
| refactor, optimize, cleanup, performance, 重构, 优化                                 | `refactor` chain       | Safe refactoring with test baselines                                   |
| architecture, 架构, 技术选型, should I use, migration                                | `arch-decision` chain  | Research → evaluate → recommend                                        |
| None of the above                                                                    | `worker`               | General-purpose fallback                                               |

**Priority:** If a task matches multiple categories, prefer the more specific agent over `worker`. For tasks that clearly span both frontend and backend, use `feature-dev` chain rather than picking one side.

## Workflow

### Step 0: Align (Mandatory)

Before writing any code, load and execute the `align` skill.

**Fast-track check:** If the task meets ALL fast-track criteria (see When This Triggers), confirm with user: _"This looks like a quick fix. Fast-track and skip alignment?"_ If user agrees → proceed to Step 1.

**Otherwise:** Execute full alignment:

```typescript
subagent({
  agent: "oracle",
  task: `加载 align skill，对以下任务执行对齐：\n\n{task}\n\n产出 alignment-report.md。\n- 如果任务不明确，执行 grilling 会话\n- 更新 CONTEXT.md 和 ADR 如有必要\n- 获得用户明确确认后再返回`,
  context: "fork",
});
```

**Never skip alignment for non-trivial tasks.** A vague request that goes straight to implementation is the #1 source of rework. 10 minutes of alignment saves hours of rewriting.

Read `alignment-report.md` before proceeding to Step 1.

### Step 1: Plan Increments (for multi-file changes)

If the task touches more than one file or feels too large for one pass, break it into vertical slices first:

**Vertical Slices (Preferred):** Build one complete path through the stack per slice.

```
Slice 1: DB schema + API endpoint + basic UI → Tests pass, user can create
Slice 2: Query + API + list UI → Tests pass, user can see
Slice 3: Update + API + edit UI → Tests pass, user can modify
```

**Contract-First Slicing:** Define API contract (types/interfaces) before parallel frontend/backend work.

**Risk-First Slicing:** Tackle the riskiest piece first to fail fast.

### Step 2: Route & Implement Per Slice

For each slice, route to the appropriate agent:

```typescript
// Example for backend task
subagent({
  agent: "worker",
  task: `{task}. Read the relevant context first, then make the smallest correct set of changes. Follow existing code patterns. Run validation commands when available.`,
  context: "fork",
});

// Example for frontend task
subagent({
  agent: "worker",
  task: `{task}. Read the relevant context first, then make the smallest correct set of changes. Follow existing code patterns. Run validation commands when available.`,
  context: "fork",
});

// Example for cross-cutting feature
subagent({
  chain: "feature-dev",
  task: `{task}`,
  context: "fork",
});
```

After each slice: **Test → Verify → Commit** before moving to the next slice.

### Step 3: Review

After all slices complete, launch a reviewer:

```typescript
subagent({
  agent: "reviewer",
  task: `Review the implementation of: {task}\n\nCheck for correctness, edge cases, security issues, and consistency with existing patterns. Run tests with -race flag. Fix any real problems you find.`,
  context: "fork",
});
```

Use `reviewer` agent for all code quality validation.

### Step 4: Simplify (代码简化)

Reviewer 验证通过后，对本次变更进行代码简化，提升可读性和可维护性。

**触发条件（同时满足）：**

- 实际修改了代码（非纯配置/文档任务）
- 变更文件数 ≤ 10（避免大规模简化不可控）

**不触发的情况：**

- 纯测试任务（只新增/修改测试文件）
- 纯配置/文档/脚本任务
- 紧急 hotfix（用户明确表示要快速修复）
- 重构任务（已包含简化逻辑，无需重复）

```typescript
subagent({
  agent: "worker",
  task: `使用 code-simplification skill 简化本次变更的代码。

聚焦范围：仅处理本次任务修改的文件，不要触碰无关代码。

原则：
1. 保持功能不变，所有测试必须继续通过
2. 减少不必要的复杂度和嵌套
3. 消除冗余代码和抽象
4. 改善变量和函数命名
5. 不要过度简化——保留有意义的抽象

输出：列出你简化了哪些内容以及原因。`,
  context: "fork",
});
```

**注意：** 如果简化步骤引入了测试失败或破坏了功能，回滚简化修改并跳过此步骤。

### Step 5: Present Results

Summarize to the user:

- What files were changed and why
- What the reviewer checked and whether issues were found
- Any remaining risks or follow-up items

If the reviewer found issues that were fixed, note what was corrected.
