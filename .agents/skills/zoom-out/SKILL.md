---
name: zoom-out
description: |
  Tell the agent to zoom out and give broader context or a higher-level perspective before making changes. Use when you're unfamiliar with a section of code or need to understand how it fits into the bigger picture. Use before modifying code in an unfamiliar area. Use when the user says "explain how this works", "how does X fit into the system", "what calls this", or when a proposed change might have cross-module impact.
---

# Zoom Out

## Philosophy

> "The best modules are deep. They allow a lot of functionality to be accessed through a simple interface."
> — John Ousterhout, A Philosophy Of Software Design

Before changing code you don't fully understand, **zoom out**. Get a map of the relevant modules and their relationships. Understand how the piece you're about to touch fits into the whole system. This prevents local fixes that create global problems.

## When to Use

- You're unfamiliar with the code area being modified
- The change touches multiple files and cross-module impact is unclear
- The user asks "how does this work?" or "what calls this?"
- Before proposing an architectural change
- After a `diagnose` session reveals the bug spans multiple modules
- When `grill-with-docs` reveals the scope is larger than initially assumed

## When NOT to Use

- The change is a one-line fix in a well-understood function
- The code area is trivial (pure utility with no callers beyond one module)
- You've already explored the relevant modules in this session

## Workflow

### Step 1 — Identify the focal module(s)

Determine which module(s) the user wants to understand or modify. Use the project's domain glossary from `CONTEXT.md` to name them correctly.

### Step 2 — Map the module graph

For each focal module, identify:

- **Callers**: Who calls this module? What do they expect?
- **Dependencies**: What does this module call? What invariants does it rely on?
- **Siblings**: What other modules live at the same abstraction level?
- **Contracts**: What is the public interface? What are the invariants and error modes?

Use LSP navigation (`incomingCalls`, `outgoingCalls`, `references`) to trace relationships accurately. Don't guess.

### Step 3 — Explain in domain language

Present the map using the project's domain glossary. Avoid generic terms like "service", "handler", "manager" when `CONTEXT.md` defines specific terms.

**Structure the explanation:**

```
## Module: {Domain-term-for-module}

### What it does
[One sentence in domain language]

### Interface
[Public types, functions, and their contracts]

### Callers
[Who calls it and for what purpose]

### Dependencies
[What it depends on and why]

### System position
[How it fits into the broader flow]
```

### Step 4 — Flag risks and cross-module impact

Based on the map, identify:

- **Breaking changes**: Will modifying the interface break callers?
- **Hidden coupling**: Are there implicit dependencies (shared state, event ordering, side effects)?
- **Test gaps**: Which parts of the module graph lack tests?
- **Deepening opportunities**: Are there shallow modules that could be deepened?

### Step 5 — Recommend next step

After zooming out, recommend the safest path forward:

- If the change is simple and localized → proceed with `implement-with-review`
- If the change spans modules with unclear boundaries → suggest `grill-with-docs` first
- If the architecture is preventing a clean fix → suggest `improve-codebase-architecture`

## Checklist

```
[ ] Identified focal module(s) using domain glossary
[ ] Mapped callers, dependencies, and siblings
[ ] Used LSP navigation to trace relationships (not guessing)
[ ] Explained in domain language from CONTEXT.md
[ ] Flagged breaking changes and hidden coupling
[ ] Identified test gaps
[ ] Recommended appropriate next skill (implement-with-review / grill-with-docs / improve-codebase-architecture)
```
