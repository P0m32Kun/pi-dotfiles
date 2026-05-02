---
name: parallel-implementation
description: |
  Automatically analyze, decompose, and execute coding tasks with intelligent parallel scheduling. 
  USE THIS SKILL whenever the user asks to implement, build, create, write, refactor, or add features to code — especially for multi-file changes, cross-module work, or tasks that touch both frontend and backend. This skill automatically evaluates whether a task can be parallelized across independent modules, split into vertical slices, or must run sequentially, then dispatches to the right agents with optimal concurrency. It replaces naive single-agent delegation with workload-aware orchestration. Always prefer this skill over direct subagent delegation when the task involves more than one file or module.
---

# Parallel Implementation Orchestrator

Intelligently decompose coding tasks and execute them with maximum safe parallelism.

## When This Triggers

- Any implementation, creation, or refactoring task
- Multi-file or cross-module changes
- Frontend + backend combined work
- Tasks where multiple independent components need building

## Core Workflow

### Phase 1: Task Analysis & Parallel Feasibility Assessment

Before dispatching any work, analyze the task:

1. **Scope the change set**: Estimate files/modules touched
2. **Identify natural boundaries**: Can the work be split by:
   - **Vertical slice** (e.g., auth-login UI + auth-login API + auth-login DB schema)
   - **Horizontal layer** (e.g., data layer vs service layer vs handler layer)
   - **Independent module** (e.g., user-service vs order-service)
3. **Check coupling**: Do the split pieces share mutable state or circular dependencies?

**Decision matrix:**

| Condition                                       | Strategy     | Subagent Mode                      |
| ----------------------------------------------- | ------------ | ---------------------------------- |
| ≥2 independent modules, no shared mutable files | **Parallel** | `tasks: [...]` + `worktree: true`  |
| Sequential dependency but each step is large    | **Chain**    | `chain: [...]`                     |
| Strong coupling, all files interdependent       | **Serial**   | Single agent, `context: "fork"`    |
| Simple task, <3 files                           | **Serial**   | Single agent, inline or fork       |
| Frontend + Backend with clear API contract      | **Parallel** | `worker` + `worker` simultaneously |

### Phase 2: Task Decomposition

If parallel is chosen, decompose into `slices`. Each slice must have:

- **Clear ownership**: Which files it will create/modify
- **Defined contract**: Inputs/outputs/interfaces it assumes from other slices
- **Validation criteria**: How to verify this slice works independently

**Decomposition templates:**

```
Vertical Slice Pattern (preferred):
  Slice A: DB migration + Repository method + API endpoint + UI form
  Slice B: DB migration + Query method + API endpoint + UI table

  Note: Each slice must declare its DB schema dependencies upfront.

Horizontal Layer Pattern (use when vertical slices conflict):
  Layer 1: Models, DB schema, migrations
  Layer 2: Service layer, business logic
  Layer 3: Handlers, routers, middleware
  Layer 4: Frontend components, API clients

Independent Module Pattern:
  Module A: User authentication subsystem
  Module B: File upload subsystem
  Module C: Notification subsystem
```

### Phase 3: Parallel Dispatch with Worktree Isolation

For parallel execution, use worktree isolation to prevent filesystem conflicts:

```typescript
// Example: Parallel vertical slices
subagent({
  tasks: [
    {
      agent: "worker",
      task: `Implement Slice A: {slice A description}.\n\nContract assumptions: {contract for slice A}.\nFiles to modify: {file list}.\nRun tests after implementation.`,
      output: "slice-a-result.md",
      progress: true,
    },
    {
      agent: "worker",
      task: `Implement Slice B: {slice B description}.\n\nContract assumptions: {contract for slice B}.\nFiles to modify: {file list}.\nRun tests after implementation.`,
      output: "slice-b-result.md",
      progress: true,
    },
  ],
  worktree: true,
  concurrency: 4,
});
```

**Critical rules for parallel dispatch:**

- Each task's `output` path must be unique
- Declare contract/interfaces upfront so slices agree on boundaries
- Each slice must run validation (tests, type-check, lint) independently
- `worktree: true` requires clean git state — check first with `git status`

### Phase 4: Merge & Integration

After parallel agents complete:

1. **Collect diffs**: Read each worktree's changes
2. **Detect conflicts**: Check if any two slices modified the same lines
3. **Merge strategy**:
   - No conflicts → Apply all diffs to main worktree sequentially
   - Interface conflicts → Resolve contract mismatch, may need re-run
   - File conflicts → Manual merge with user review

```typescript
// Read all slice results
subagent({
  tasks: [
    {
      agent: "delegate",
      task: "Read slice-a-result.md and summarize the changes made",
      output: false,
    },
    {
      agent: "delegate",
      task: "Read slice-b-result.md and summarize the changes made",
      output: false,
    },
  ],
});

// Apply to main branch (single-threaded to avoid race conditions)
subagent({
  agent: "worker",
  task: `Merge all slice implementations into the main branch.\nApply changes from worktrees carefully, preserving each slice's work.\nRun full test suite after merge.`,
});
```

### Phase 5: Parallel Review

Review all changes in parallel for speed:

```typescript
subagent({
  tasks: [
    {
      agent: "reviewer",
      task: "Review correctness and edge cases of the merged implementation",
    },
    {
      agent: "reviewer",
      task: "Review code quality, consistency, and security of the merged implementation",
    },
    {
      agent: "oracle",
      task: "Review architecture decisions and check for drift from project conventions",
      context: "fork",
    },
  ],
  concurrency: 3,
});
```

## Agent Routing (Same Rules as implement-with-review)

| Task Domain           | Parallel Agent Choice                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| Backend only          | Multiple `worker` agents                                                |
| Frontend only         | Multiple `worker` agents                                                |
| Frontend + Backend    | `worker` + `worker` in parallel tasks                                   |
| Security-critical     | `security-audit` chain, NOT parallel (security needs coherence)         |
| Bug fix               | `bug-fix` chain, NOT parallel (root cause analysis needs single thread) |
| Architecture/Refactor | `refactor` chain for planning, then parallel `worker` for execution     |

## Complete Example: Multi-Module Feature

User asks: "Implement a full file upload system with S3 backend, progress tracking, and a React upload component."

```typescript
// Phase 1 & 2: Analysis + Decomposition (done by main agent)
// Decision: 3 independent modules → PARALLEL

// Phase 3: Parallel Implementation
subagent({
  tasks: [
    {
      agent: "worker",
      task: `Implement S3 multipart upload service:\n- S3 client configuration with presigned URLs\n- Multipart upload initiation/complete/abort handlers\n- Progress tracking via Redis/DynamoDB\n- API endpoints: POST /upload/init, POST /upload/part, POST /upload/complete\n\nAssumed contract: UploadSession {id, key, parts[], status} returned by init endpoint.\nRun go test ./upload/... after implementation.`,
      output: "upload-backend-result.md",
      progress: true,
    },
    {
      agent: "worker",
      task: `Implement React upload component:\n- Drag-and-drop zone with file validation\n- Chunked upload using the /upload/* API contract\n- Progress bar with per-file and overall progress\n- Retry logic for failed chunks\n- Storybook stories for all states\n\nAssumed contract: UploadSession {id, key, parts[], status} from POST /upload/init.\nRun npm test and type-check after implementation.`,
      output: "upload-frontend-result.md",
      progress: true,
    },
    {
      agent: "worker",
      task: `Implement upload metadata & listing service:\n- Upload record database model\n- Query endpoints: GET /uploads, GET /uploads/:id\n- Webhook notification on upload complete\n- Cleanup job for abandoned multipart uploads\n\nAssumed contract: Same UploadSession type from upload service.\nRun go test ./upload-meta/... after implementation.`,
      output: "upload-meta-result.md",
      progress: true,
    },
  ],
  worktree: true,
  concurrency: 3,
});

// Phase 4: Merge
subagent({
  agent: "worker",
  task: `Merge all three upload modules from parallel worktrees into main branch.\nEnsure the UploadSession contract is consistent across all modules.\nRun full integration tests.`,
});

// Phase 5: Parallel Review
subagent({
  tasks: [
    {
      agent: "reviewer",
      task: "Review upload system for correctness, race conditions, and edge cases",
    },
    {
      agent: "reviewer",
      task: "Review code quality and test coverage of upload system",
    },
    {
      agent: "security-audit",
      task: "Review upload endpoints for security: file type validation, size limits, authz, path traversal",
    },
  ],
  concurrency: 3,
});
```

## Fallback to Serial

If ANY of these conditions are true, use serial execution instead:

- Task touches fewer than 3 files
- Strong circular dependencies between components
- Security-critical changes requiring holistic review
- Bug fixes where root cause is unknown
- The git working tree is dirty (and user doesn't want to commit first)

Serial fallback:

```typescript
subagent({
  agent: "worker",
  task: `{original task} — executing serially due to tight coupling/small scope.`,
  context: "fork",
});
```

## Constraints & Safety

- **Worktree requires clean git state**: Run `git status` before parallel dispatch. If dirty, ask user to commit or use serial mode.
- **No overlapping output files**: Each parallel task must have a unique `output` path.
- **Max 4 parallel tasks by default**: Raise `concurrency` only for truly independent modules.
- **Merge is always single-threaded**: Never run merge operations in parallel.
- **Interface contract first**: For parallel slices, define shared types/interfaces BEFORE dispatch, or designate one slice as "contract owner".
- **Review after merge**: Always review the merged result, not individual worktrees, to catch integration issues.

## Anti-Patterns

❌ **Don't** parallelize tightly coupled files (e.g., refactoring a shared utility used by 10 files)
❌ **Don't** let parallel agents modify the same file
❌ **Don't** skip the merge phase and leave changes in worktrees
❌ **Don't** use parallel for security patches (needs holistic analysis)
❌ **Don't** dispatch more parallel tasks than the system can handle (default max 4)
