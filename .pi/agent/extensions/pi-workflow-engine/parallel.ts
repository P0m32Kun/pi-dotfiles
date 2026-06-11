/**
 * Parallel execution support for pi-workflow-engine.
 *
 * Provides concurrent step execution with configurable concurrency limits.
 */

import type { StepDefinition, ParallelGroup } from './types.js';

export interface ParallelExecutorConfig {
  execute: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface StepResult {
  stepId: string;
  status: 'success' | 'failure' | 'skipped';
  output?: unknown;
  error?: string;
  duration: number;
}

export interface ParallelResult {
  results: StepResult[];
  duration: number;
}

export interface GroupResult {
  group: string;
  results: StepResult[];
  duration: number;
}

export interface MultipleGroupsResult {
  groups: GroupResult[];
  duration: number;
}

export class ParallelExecutor {
  private executeFn: (tool: string, args: Record<string, unknown>) => Promise<unknown>;

  constructor(config: ParallelExecutorConfig) {
    this.executeFn = config.execute;
  }

  /**
   * Execute multiple steps in parallel with concurrency limit.
   */
  async execute(
    steps: StepDefinition[],
    options: { maxConcurrency?: number } = {}
  ): Promise<ParallelResult> {
    const startTime = Date.now();
    const maxConcurrency = options.maxConcurrency ?? steps.length;
    const results: StepResult[] = new Array(steps.length);
    let nextIndex = 0;

    // Create worker pool
    const workers: Promise<void>[] = [];
    const workerCount = Math.min(maxConcurrency, steps.length);

    for (let i = 0; i < workerCount; i++) {
      workers.push(this.worker(steps, results, () => nextIndex++));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    return {
      results,
      duration: Date.now() - startTime
    };
  }

  /**
   * Worker function for parallel execution.
   */
  private async worker(
    steps: StepDefinition[],
    results: StepResult[],
    getNextIndex: () => number
  ): Promise<void> {
    while (true) {
      const index = getNextIndex();
      if (index >= steps.length) break;

      const step = steps[index];
      const startTime = Date.now();

      try {
        const output = await this.executeFn(step.tool, step.args);
        results[index] = {
          stepId: step.id,
          status: 'success',
          output,
          duration: Date.now() - startTime
        };
      } catch (error) {
        results[index] = {
          stepId: step.id,
          status: 'failure',
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        };
      }
    }
  }

  /**
   * Execute a parallel group.
   */
  async executeGroup(
    group: ParallelGroup,
    steps: StepDefinition[]
  ): Promise<GroupResult> {
    const startTime = Date.now();

    // Filter steps that belong to this group
    const groupSteps = steps.filter(step => group.steps.includes(step.id));

    // Execute with group's concurrency limit
    const result = await this.execute(groupSteps, {
      maxConcurrency: group.max_concurrency
    });

    return {
      group: group.group,
      results: result.results,
      duration: Date.now() - startTime
    };
  }

  /**
   * Execute multiple parallel groups sequentially.
   */
  async executeMultipleGroups(
    groups: ParallelGroup[],
    steps: StepDefinition[]
  ): Promise<MultipleGroupsResult> {
    const startTime = Date.now();
    const groupResults: GroupResult[] = [];

    for (const group of groups) {
      const result = await this.executeGroup(group, steps);
      groupResults.push(result);
    }

    return {
      groups: groupResults,
      duration: Date.now() - startTime
    };
  }

  /**
   * Execute steps with dependencies resolved.
   */
  async executeWithDependencies(
    steps: StepDefinition[],
    options: { maxConcurrency?: number } = {}
  ): Promise<ParallelResult> {
    const startTime = Date.now();
    const completed = new Set<string>();
    const results: StepResult[] = [];

    // Build dependency graph
    const dependencyMap = new Map<string, string[]>();
    for (const step of steps) {
      dependencyMap.set(step.id, step.depends_on ?? []);
    }

    // Execute steps in topological order with parallelism
    while (completed.size < steps.length) {
      // Find steps whose dependencies are all completed
      const ready = steps.filter(step => {
        if (completed.has(step.id)) return false;
        const deps = dependencyMap.get(step.id) ?? [];
        return deps.every(dep => completed.has(dep));
      });

      if (ready.length === 0) {
        throw new Error('Circular dependency detected');
      }

      // Execute ready steps in parallel
      const batchResult = await this.execute(ready, options);
      
      for (const result of batchResult.results) {
        results.push(result);
        if (result.status === 'success') {
          completed.add(result.stepId);
        }
      }

      // Stop if any step failed
      if (batchResult.results.some(r => r.status === 'failure')) {
        break;
      }
    }

    return {
      results,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Utility: Execute promises with concurrency limit.
 */
export async function parallelLimit<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<unknown>
): Promise<void> {
  const results: Promise<void>[] = [];
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) break;
      await fn(items[index], index);
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  for (let i = 0; i < workerCount; i++) {
    results.push(worker());
  }

  await Promise.all(results);
}
