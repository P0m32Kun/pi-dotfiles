---
name: grill-with-docs
description: |
  Grilling session that challenges the user's plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when the user's request is vague, underspecified, or involves architectural decisions. Use before implement-with-review when the task scope, interfaces, or domain terminology are unclear. Use when the user says "I want to build X" without specifying interfaces, constraints, or edge cases.
---

# Grill With Docs

## Philosophy

> "No-one knows exactly what they want"
> — David Thomas & Andrew Hunt, The Pragmatic Programmer

The most common failure mode in AI-assisted development is **misalignment**. You think the agent knows what you want. Then you see what it's built — and realize it didn't understand you at all.

The fix is a **grilling session**: getting the agent to ask detailed questions before a single line of code is written. This skill turns vague requests into precise specifications, and in the process builds a **shared language** between you and the agent.

## When to Use

- User describes a feature but doesn't specify interfaces, constraints, or edge cases
- User uses overloaded or ambiguous terms ("account", "user", "handler")
- The task touches multiple modules and boundaries are unclear
- The request involves architectural or design decisions
- Before `implement-with-review` when any uncertainty exists about WHAT to build
- When `CONTEXT.md` exists and user language conflicts with the glossary

## When NOT to Use

- The request is already precise: "Add a `ValidateEmail` function that returns `(bool, error)`"
- Pure configuration or documentation changes with no behavioral ambiguity
- One-line fixes with no interface impact

## Workflow

### Step 0 — Read Existing Context

Before grilling, check for existing documentation:

1. If `CONTEXT-MAP.md` exists at repo root → read it, identify which context(s) the topic belongs to
2. If only a root `CONTEXT.md` exists → read it
3. If `docs/adr/` exists → scan for ADRs relevant to the area being touched
4. If neither exists → we'll create them lazily during the session

### Step 1 — Interview (One Question at a Time)

Ask questions **one at a time**, waiting for feedback on each before continuing.

**Rules for questioning:**

- **Challenge against the glossary**: When the user uses a term that conflicts with `CONTEXT.md`, call it out immediately: _"Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"_
- **Sharpen fuzzy language**: When the user uses vague or overloaded terms, propose a precise canonical term: _"You're saying 'account' — do you mean the Customer or the User? Those are different things."_
- **Discuss concrete scenarios**: Stress-test domain relationships with specific edge cases. Invent scenarios that probe boundaries between concepts.
- **Cross-reference with code**: When the user states how something works, check whether the code agrees. If you find a contradiction, surface it.

**Question categories to walk through:**

1. **What**: What exactly should the system do? What is the desired end state?
2. **Who**: Who are the actors? What are their roles and permissions?
3. **When**: What triggers this behavior? What are the preconditions?
4. **Where**: Which modules/files are touched? What are the boundaries?
5. **How**: What should the public interface look like? (function signatures, types, APIs)
6. **Edge cases**: What happens when inputs are invalid? When dependencies fail? When state is unexpected?
7. **Constraints**: Are there performance, security, or compatibility requirements?

**Example question progression:**

```
Q1: "You want to add a 'review' feature. Who can submit a review — any user, or only verified purchasers?"
    → User answers
Q2: "Got it — only verified purchasers. When a review is submitted, should it be published immediately or held for moderation?"
    → User answers
Q3: "Immediate publication. What fields must a review have at minimum?"
    → User answers
Q4: "Rating (1-5) and text body. What happens if someone submits a review for a product they haven't purchased?"
    → ...
```

### Step 2 — Update CONTEXT.md Inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen.

**Create files lazily:**

- No `CONTEXT.md` exists? Create one at repo root when the first term is resolved.
- No `docs/adr/` exists? Create it when the first ADR is needed.

**Format**: See [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md)

**Rules:**

- Only include terms that are meaningful to domain experts. General programming concepts (timeouts, errors, utility patterns) don't belong.
- Be opinionated. When multiple words exist for the same concept, pick the best one and list others as aliases to avoid.
- Flag conflicts explicitly in "Flagged ambiguities".
- Show relationships between concepts with cardinality.

### Step 3 — Offer ADRs Sparingly

Only offer to create an ADR when **all three** are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR.

**Format**: See [ADR-FORMAT.md](./ADR-FORMAT.md)

### Step 4 — Summarize and Hand Off

Once the grilling session completes, present a concise summary:

```
## Aligned Specification

### What we're building
[One-paragraph summary]

### Public interface
[Signatures, types, API endpoints]

### Key behaviors
[Ordered list of what the system must do]

### Edge cases handled
[How invalid inputs, failures, and edge states are handled]

### Updated documentation
- CONTEXT.md: [terms added/modified]
- ADRs: [any created]

### Recommended next step
[Typically: proceed with implement-with-review]
```

Then ask the user: **"Does this accurately capture what you want? If yes, I'll proceed with implementation."**

Only proceed to `implement-with-review` after explicit confirmation.

## Checklist

```
[ ] Read existing CONTEXT.md / CONTEXT-MAP.md and relevant ADRs
[ ] Asked questions one at a time, waited for answers
[ ] Challenged ambiguous or conflicting terminology
[ ] Proposed precise canonical terms for vague language
[ ] Stress-tested with concrete edge-case scenarios
[ ] Cross-referenced user's claims against actual code
[ ] Updated CONTEXT.md inline as terms were resolved
[ ] Created ADRs only for hard-to-reverse, surprising, trade-off decisions
[ ] Presented aligned specification for user confirmation
[ ] Got explicit user approval before proceeding to implementation
```
