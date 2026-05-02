---
name: research-and-implement
description: |
  Automatically triggers web research via a researcher subagent, then delegates implementation to a worker subagent. USE THIS SKILL whenever the user's task depends on external knowledge: API documentation, library usage, current best practices, compatibility concerns, or anything requiring up-to-date information from the web. Use for tasks involving new libraries, frameworks, protocols, or technologies the codebase doesn't already use. Use for "how do I do X" questions that need research before implementation. Do NOT guess at API usage or best practices when this skill is available.
---

# Research and Implement

Research external knowledge first, then delegate implementation to the most appropriate specialized agent based on the task domain.

## When This Triggers

- User asks to integrate a new library, framework, or API
- User asks about "best practices" for something external
- User wants to use a technology not currently in the codebase
- Task involves protocol implementation, crypto, auth mechanisms, or external services
- User asks "how does X work" or "what's the right way to do Y" where Y involves external knowledge
- Any uncertainty about API signatures, compatibility, or current recommendations

## Agent Routing Rules

After research completes, analyze the task and route implementation to the most specific agent. Do NOT default to `worker` if a specialized agent matches.

| If task involves...                                              | Use agent              | Notes                                                           |
| ---------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------- |
| Frontend tech (React, Tauri, CSS, UI, component, Tailwind, 前端) | `worker`               | Loads frontend-ui-engineering, tauri-v2 skills                  |
| Backend tech (Go, API, database, service, goroutine, 后端)       | `worker`               | Loads golang-pro, golang-testing skills                         |
| Both frontend AND backend integration                            | `feature-dev` chain    | Full chain: research already done, skip to implementation steps |
| Security mechanisms, auth, crypto, vulnerability                 | `security-audit` chain | Security-focused remediation                                    |
| Bug caused by external integration                               | `bug-fix` chain        | Systematic fix workflow                                         |
| Architecture or migration decision                               | `arch-decision` chain  | Evaluate options before implementing                            |
| None of the above                                                | `worker`               | General-purpose fallback                                        |

**Priority:** Prefer specialized agents over `worker`. For tasks spanning both frontend and backend, use `feature-dev` chain.

## Workflow

### Step 1: Research

```typescript
subagent({
  agent: "researcher",
  task: `Research for: {task}\n\nFocus on official documentation, current best practices, and concrete code examples. Produce a concise research brief with findings and source citations.`,
  context: "fresh",
});
```

### Step 2: Route & Implement

After research completes, read the research output and delegate to the appropriate agent:

```typescript
// Example for backend integration
subagent({
  agent: "worker",
  task: `Implement: {task}\n\nUse the research findings as your reference. Follow the patterns and examples discovered during research. Apply findings to this codebase's conventions.`,
  context: "fork",
});

// Example for frontend integration
subagent({
  agent: "worker",
  task: `Implement: {task}\n\nUse the research findings as your reference. Follow the patterns and examples discovered during research. Apply findings to this codebase's conventions.`,
  context: "fork",
});

// Example for cross-cutting feature
subagent({
  chain: "feature-dev",
  task: `{task}\n\nResearch findings are already available. Focus on implementation steps.`,
  context: "fork",
});
```

### Step 3: Present Results

Summarize to the user:

- Key research findings (with sources)
- How the implementation applies those findings
- Any gaps or areas where research was inconclusive

If research reveals the task is more complex than initially apparent, flag this before implementing.
