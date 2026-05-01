---
name: oracle-consult
description: |
  Automatically triggers the oracle subagent for high-stakes architectural decisions, consistency checks, and strategic guidance. USE THIS SKILL whenever the user faces an architectural choice, a significant refactoring decision, a tradeoff between competing approaches, or any decision that could have lasting impact on the codebase. Use when there are multiple valid ways to proceed and the choice matters. Use when you (the main agent) feel uncertain about the best direction. Use for "should I do X or Y" questions where X and Y are substantial alternatives. Do NOT make consequential architectural decisions inline when this skill is available — consult the oracle first.
---

# Oracle Consult

Consult the oracle subagent for important architectural and strategic decisions.

## When This Triggers

- User asks "should I use X or Y" for significant technical choices
- User proposes a major refactoring or architecture change
- There are multiple valid implementation approaches with different tradeoffs
- The decision affects multiple files, modules, or the overall system design
- User asks for "advice", "guidance", or "recommendation" on technical direction
- You (the main agent) are unsure which approach is best
- The task could introduce hidden coupling, breaking changes, or technical debt
- Any decision that would be hard to reverse later

## Workflow

### Step 1: Consult Oracle

```typescript
subagent({
  agent: "oracle",
  task: `Review this decision and challenge assumptions: {task}\n\nAnalyze the tradeoffs, identify hidden risks or contradictions, and recommend the best path forward. Consider consistency with existing codebase decisions.`,
  context: "fork"
})
```

### Step 2: Present and Decide

Present the oracle's analysis to the user clearly:

1. **The options** — what approaches were considered
2. **The oracle's recommendation** — which path is preferred and why
3. **Risks identified** — what could go wrong with each approach
4. **Your recommendation** — as the main agent, state what you think after considering the oracle's input

Ask the user for a decision. Do NOT proceed with implementation until the user confirms or overrides the recommendation.

### Step 3: Optional Implementation

If the user approves and wants you to implement:

```typescript
subagent({
  agent: "oracle-executor",
  task: `Implement the approved approach: {task}. The approved direction is: <direction>.`,
  context: "fork"
})
```

## Important Rules

- The oracle is advisory. The final decision always rests with the user (or you, acting on their behalf).
- Do not silently override the oracle's concerns. If you disagree, explain why.
- If the oracle identifies a serious risk, escalate to the user rather than proceeding.
