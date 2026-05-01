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

Launch a chain that maps the codebase first, then creates an implementation plan:

```typescript
subagent({
  chain: [
    {
      agent: "scout",
      task: `{task}. Map the relevant code areas, identify key files, interfaces, and dependencies. Write a focused context.md with exactly what another agent needs to act.`,
      context: "fresh"
    },
    {
      agent: "planner",
      task: `Create a concrete implementation plan from this reconnaissance. The original task was: {task}\n\nRead the scout's context.md output first, then write a detailed plan.md.`,
      context: "fresh"
    }
  ],
  chainDir: `/tmp/pi-subagents/recon-plan-${Date.now()}`
})
```

After the chain completes, read the outputs and present a summary to the user.

## Output Format

Present the results concisely:

1. **What was found** — key files and patterns (from scout)
2. **Recommended plan** — numbered steps with file names (from planner)
3. **Risks** — any concerns the planner flagged

Ask the user if they want to proceed with the plan, modify it, or need clarification on any part.
