---
description: Execute a coding task with intelligent parallel decomposition. Auto-analyzes the task, splits it into independent modules/slices if feasible, dispatches parallel worktree-isolated agents, merges results, and runs parallel review.
argument-hint: "<task description>"
---

Orchestrate the implementation of "$@" using the parallel-implementation skill.

Follow this workflow:

1. **Analyze**: Determine if this task can be split into ≥2 independent modules, vertical slices, or layers.
   - Check: file overlap, dependency direction, coupling strength
   - If <3 files or tightly coupled → fallback to serial agent

2. **Decompose**: Define slices with clear ownership, contract boundaries, and validation criteria

3. **Dispatch** (if parallel):
   ```typescript
   subagent({
     tasks: [/* one per slice */],
     worktree: true,
     concurrency: 4
   })
   ```

4. **Merge**: Collect all worktree diffs, resolve any contract mismatches, apply to main branch

5. **Review**: Run parallel review (qa-engineer + reviewer + security if applicable)

Use the appropriate specialized agents (backend-dev, frontend-dev, etc.) per slice.
