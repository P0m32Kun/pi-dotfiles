---
name: align
description: |
  Ensure agent and user share precise understanding before any code is written. Assesses task clarity, executes grilling sessions for vague requests, and produces alignment documentation. Use when starting any implementation task, when the user's request lacks specific interfaces or behavior constraints, when domain terms are ambiguous, or when the task touches multiple modules with unclear boundaries. Use before implement-with-review, dev-workflow, or quick chain. Users can skip with "skip align" or "fast-track".
---

# Align

> "No-one knows exactly what they want"
> — David Thomas & Andrew Hunt, The Pragmatic Programmer

The #1 source of rework in AI-assisted development is **misalignment**. This skill ensures we align before we build. It is the mandatory first step for all coding tasks, with an escape hatch for genuinely trivial changes.

## When to Skip (Fast-Track)

A task qualifies for fast-track **only if ALL of the following are true**:

- [ ] The change is a one-line or single-file fix with no interface impact
- [ ] The desired behavior is unambiguous (e.g., "fix off-by-one on line 42")
- [ ] No new domain concepts or terminology are introduced
- [ ] No architectural or design decisions are involved
- [ ] User explicitly says "fast-track", "skip align", or "just fix it"

**If ANY item is missing → execute full alignment.**

## Phase 1: Assess Clarity (30 seconds)

Read `{task}` and check for these alignment signals:

```
Signal 1: Interface defined?
  └── Are function signatures, types, API shapes, or UI wireframes specified?

Signal 2: Behavior constrained?
  └── Is the success path described? Error path? At least one edge case?

Signal 3: Scope bounded?
  └── Are module boundaries clear? Is there an explicit "out of scope" list?

Signal 4: Domain language consistent?
  └── Do terms match CONTEXT.md? Are overloaded words ("user", "account", "handler") disambiguated?
```

**Scoring:**

- 4/4 signals present → Fast-track eligible (still confirm with user)
- ≤3/4 signals present → Execute grilling session

## Phase 2: Grilling Session

### Step 2.1: Read Existing Context

Before asking questions, understand what the project already knows:

1. If `CONTEXT-MAP.md` exists → read it, identify relevant context(s)
2. If `CONTEXT.md` exists at root → read it
3. If `docs/adr/` exists → scan for relevant ADRs
4. Briefly explore the codebase in the affected area (≤3 files)

### Step 2.2: Interview (One Question at a Time)

Ask questions **one at a time**, waiting for user feedback before continuing.

**Rules:**

- **Challenge against glossary**: If user's term conflicts with `CONTEXT.md`, call it out immediately
- **Sharpen fuzzy language**: Propose precise canonical terms for overloaded words
- **Stress-test with scenarios**: Invent edge cases that probe boundaries between concepts
- **Cross-reference with code**: If user claims something works a certain way, verify it

**Question categories (ask only what's missing from Phase 1 assessment):**

1. **What**: What exactly should the system do? What is the desired end state?
2. **Who**: Who are the actors? What are their roles and permissions?
3. **When**: What triggers this behavior? What are the preconditions?
4. **Where**: Which modules/files are touched? What are the boundaries?
5. **How**: What should the public interface look like?
6. **Edge cases**: Invalid inputs? Dependency failures? Unexpected state?
7. **Constraints**: Performance, security, compatibility requirements?

**Example progression:**

```
Q1: "You want to add a 'review' feature. Who can submit a review — any user, or only verified purchasers?"
    → User answers
Q2: "Got it — only verified purchasers. When a review is submitted, should it be published immediately or held for moderation?"
    → User answers
Q3: "Immediate publication. What fields must a review have at minimum?"
    → ...
```

### Step 2.3: Update Documentation Inline

As terms are resolved, update `CONTEXT.md` immediately. Do not batch.

**Create files lazily:**

- No `CONTEXT.md`? Create at repo root when first term is resolved
- No `docs/adr/`? Create when first ADR is needed

**Format**: See [grill-with-docs/CONTEXT-FORMAT.md](../grill-with-docs/CONTEXT-FORMAT.md)

**ADR criteria** (all three must be true):

1. Hard to reverse
2. Surprising without context
3. Result of a real trade-off

See [grill-with-docs/ADR-FORMAT.md](../grill-with-docs/ADR-FORMAT.md)

### Step 2.4: Summarize and Confirm

Present aligned specification:

```
## Aligned Specification

### What we're building
[One-paragraph summary]

### Public interface
[Signatures, types, API endpoints, UI components]

### Key behaviors
[Ordered list of what the system must do]

### Edge cases handled
[How invalid inputs, failures, and edge states are handled]

### Out of scope
[Explicitly excluded]

### Updated documentation
- CONTEXT.md: [terms added/modified]
- ADRs: [any created]
```

**Ask user: "Does this accurately capture what you want?"**

Only proceed after explicit confirmation. If user says "close enough" or "let's iterate" → continue grilling. If user says "yes" or "proceed" → alignment complete.

## Phase 3: Produce Alignment Report

Write `alignment-report.md` (or `alignment-brief.md` for quick mode):

```md
# Alignment Report: {Task Title}

## Fast-track: [yes/no]

## Aligned Specification

[Copy from Phase 2.4]

## Key Decisions

[Trade-offs made, constraints acknowledged]

## Risks

[What could go wrong, mitigation ideas]

## Recommended Next Step

[implement-with-review / dev-workflow / quick / zoom-out]
```

## Skip Mechanisms

User can interrupt at any time:

| User says                                  | Action                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| "skip align" / "fast-track" / "直接开始"   | Stop grilling, mark fast-track, proceed to implementation              |
| "够了" / "开始写代码" / "enough"           | Stop immediately, produce alignment report with current state, proceed |
| "不是这个意思" / "that's not what I meant" | Backtrack to last confirmed understanding, re-ask                      |

## Checklist

```
[ ] Assessed clarity against 4 signals
[ ] Read existing CONTEXT.md and relevant ADRs
[ ] Asked questions one at a time, waited for answers
[ ] Challenged ambiguous or conflicting terminology
[ ] Proposed precise canonical terms
[ ] Stress-tested with concrete edge-case scenarios
[ ] Cross-referenced user's claims against actual code
[ ] Updated CONTEXT.md inline as terms resolved
[ ] Created ADRs only for hard-to-reverse, surprising, trade-off decisions
[ ] Presented aligned specification for user confirmation
[ ] Got explicit user approval before proceeding
[ ] Produced alignment report
```
