---
name: recon-and-plan
description: |
  Automatically triggers a reconnaissance and planning subagent chain for codebase exploration, architecture decisions, and implementation planning. USE THIS SKILL whenever the user needs to understand a codebase, plan a refactoring, design a new feature, or make architectural decisions — even if they don't explicitly ask for "planning" or "reconnaissance." Use for any task involving codebase mapping, file structure analysis, dependency understanding, or multi-step implementation planning. This skill delegates to specialized scout + planner subagents for better results than doing it inline.
---

# Recon and Plan

Automatically delegate codebase reconnaissance and implementation planning to specialized subagents.

## When This Triggers

- User asks about "how does this work" or "what's the architecture"
- User wants to add a new feature and needs to understand the codebase first
- User asks for an implementation plan, migration plan, or refactoring plan
- User mentions refactoring, restructuring, or changing how something works
- User asks "where should I start" or "which files need changes"
- Any task that requires understanding file relationships before acting

## Workflow

### Step 0: Task Clarification

Before dispatching any agents, confirm the scope with the user:

1. **Identify the goal**: What does the user want to achieve? (feature, refactor, migration, understanding)
2. **Identify constraints**: Any tech stack limitations, deadlines, or non-goals?
3. **Identify entry points**: Does the user already know some relevant files, or is this a blank slate?

If the user's request is vague (e.g., "improve performance"), ask clarifying questions before proceeding.

### Step 1: Scout — Codebase Reconnaissance

Dispatch `scout` to map the relevant code areas with specific instructions:

```typescript
subagent({
  agent: "scout",
  task: `Mission: {task}

Explore the codebase and write a focused context.md containing:

1. **Files Retrieved** — exact file paths and line ranges that matter
2. **Key Code** — critical types, interfaces, functions, and small snippets
3. **Architecture** — how the pieces connect (data flow, dependencies)
4. **Start Here** — the first file another agent should open and why
5. **Constraints** — existing patterns, naming conventions, framework versions
6. **Open Questions** — anything unclear that needs clarification

Use grep, find, ls, and read. Do not make edits.`,
  context: "fresh",
});
```

**Scout must explore these areas** (skip irrelevant ones):

| Area                    | Check                                      |
| ----------------------- | ------------------------------------------ |
| Project structure       | root files, src/ or internal/ layout       |
| Tech stack              | go.mod, package.json, Cargo.toml, etc.     |
| Entry points            | main.go, index.ts, App.tsx, etc.           |
| Existing models/schemas | DB entities, API DTOs                      |
| API/routing layer       | handlers, controllers, routers             |
| Configuration           | env vars, config files, secrets management |
| Tests                   | test structure, coverage, frameworks       |
| Dependencies            | external libraries, internal packages      |

### Step 2: Checkpoint — User Confirmation

**CRITICAL: Pause and present scout findings to the user before proceeding.**

Read the scout's `context.md` and summarize:

```
📋 Scout 发现摘要
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
技术栈: {stack}
关键文件: {file1}, {file2}, {file3}
架构模式: {pattern}
注意事项: {constraints}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
是否继续制定 plan？ [继续 / 补充探索某区域 / 取消]
```

**Do NOT proceed to planner without user confirmation.**

### Step 3: Planner — Implementation Planning

After user confirms, dispatch `planner` with the scout's context:

```typescript
subagent({
  agent: "planner",
  task: `Create a concrete implementation plan for: {task}

Read the scout's context.md first, then write a detailed plan.md with:

1. **Goal** — one sentence summary
2. **Tasks** — numbered steps, each small and actionable
   - File: exact path
   - Changes: what to modify
   - Acceptance: how to verify
3. **Files to Modify** — existing files and what changes
4. **New Files** — paths and purposes
5. **Dependencies** — which tasks depend on others
6. **Risks** — anything likely to go wrong
7. **Rollback Strategy** — how to undo if things break

Be specific. Name exact files. Use the project's existing patterns.`,
  context: "fresh",
});
```

### Step 4: Result Presentation & Decision

Read the planner's `plan.md` and present to the user:

```
📋 实施计划
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
目标: {goal}

步骤:
1. {task1} → {file1}
2. {task2} → {file2}
...

风险: {risks}
预估: {effort estimate if possible}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请选择:
[✅ 按此计划执行] [✏️ 修改某些步骤] [❓ 需要解释] [❌ 取消]
```

## Output Format

Present results in this structure:

1. **What was found** — key files, patterns, tech stack (from scout)
2. **Recommended plan** — numbered steps with exact file names (from planner)
3. **Risks & mitigations** — concerns and how to handle them
4. **Next action** — explicit question asking user to proceed, modify, or cancel

## Boundary Conditions & Fallbacks

### Scout fails or returns empty

- **Cause**: Codebase is empty, git not initialized, or task is completely unrelated to existing code
- **Action**: Ask user for more context, or offer to scaffold a new project instead

### Plan is too large (> 10 tasks or > 20 files)

- **Action**: Present the full plan, then suggest splitting into phases: "Phase 1 covers tasks 1-3, Phase 2 covers 4-6. Shall we start with Phase 1?"

### User disagrees with the plan

- **Action**: Ask specifically what to change. Do not restart from scratch. Modify only the disputed parts.

### Existing code contradicts the plan

- **Action**: Re-run scout on the specific conflicting area, then adjust the plan.

### No tests exist in the codebase

- **Action**: Flag this as a risk. Include "Add tests for {feature}" as an explicit task in the plan.

## Constraints

- Scout must NOT edit files — read-only exploration
- Planner must NOT edit files — read context, write plan only
- Both agents use `context: "fresh"` to avoid inheriting stale conversation state
- Always ask user confirmation before proceeding to next step
- Do not assume project structure — always verify with `ls` or `find` first
