/**
 * Multi-agent executor for pi-multi-agent.
 *
 * Provides single, parallel, chain, and auto execution modes.
 * Covers all subagent capabilities.
 */

import type {
  MultiAgentExecution,
  SingleExecution,
  ParallelExecution,
  ChainExecution,
  AutoExecution,
  SingleResult,
  MultiAgentResult,
  SubTask,
  TaskDecomposer,
  ResultAggregator
} from './types.js';

export interface AgentExecutor {
  execute(agent: string, task: string, cwd?: string): Promise<SingleResult>;
}

export class MultiAgentExecutor {
  private agentExecutor: AgentExecutor;
  private decomposer?: TaskDecomposer;
  private aggregator?: ResultAggregator;

  constructor(
    agentExecutor: AgentExecutor,
    decomposer?: TaskDecomposer,
    aggregator?: ResultAggregator
  ) {
    this.agentExecutor = agentExecutor;
    this.decomposer = decomposer;
    this.aggregator = aggregator;
  }

  /**
   * Execute based on the execution mode.
   */
  async execute(execution: MultiAgentExecution): Promise<MultiAgentResult> {
    const startTime = Date.now();

    switch (execution.mode) {
      case 'single':
        return this.executeSingle(execution, startTime);
      case 'parallel':
        return this.executeParallel(execution, startTime);
      case 'chain':
        return this.executeChain(execution, startTime);
      case 'auto':
        return this.executeAuto(execution, startTime);
      default:
        throw new Error(`Unknown execution mode: ${(execution as any).mode}`);
    }
  }

  /**
   * Execute single agent task.
   */
  private async executeSingle(
    execution: SingleExecution,
    startTime: number
  ): Promise<MultiAgentResult> {
    try {
      const result = await this.agentExecutor.execute(
        execution.agent,
        execution.task,
        execution.cwd
      );

      return {
        mode: 'single',
        results: [result],
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        mode: 'single',
        results: [{
          agent: execution.agent,
          agentSource: 'unknown',
          task: execution.task,
          exitCode: 1,
          output: '',
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        }],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Execute multiple tasks in parallel.
   */
  private async executeParallel(
    execution: ParallelExecution,
    startTime: number
  ): Promise<MultiAgentResult> {
    const maxConcurrency = execution.maxConcurrency ?? execution.tasks.length;
    const results: SingleResult[] = new Array(execution.tasks.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= execution.tasks.length) break;

        const task = execution.tasks[index];
        try {
          results[index] = await this.agentExecutor.execute(
            task.agent,
            task.task,
            task.cwd
          );
        } catch (error) {
          results[index] = {
            agent: task.agent,
            agentSource: 'unknown',
            task: task.task,
            exitCode: 1,
            output: '',
            duration: 0,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };

    // Create worker pool
    const workerCount = Math.min(maxConcurrency, execution.tasks.length);
    const workers: Promise<void>[] = [];
    for (let i = 0; i < workerCount; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    return {
      mode: 'parallel',
      results,
      duration: Date.now() - startTime
    };
  }

  /**
   * Execute steps in chain mode with {previous} placeholder support.
   */
  private async executeChain(
    execution: ChainExecution,
    startTime: number
  ): Promise<MultiAgentResult> {
    const results: SingleResult[] = [];
    let previousOutput = '';

    for (const step of execution.steps) {
      // Replace {previous} placeholder with previous output
      const task = step.task.replace(/\{previous\}/g, previousOutput);

      try {
        const result = await this.agentExecutor.execute(
          step.agent,
          task,
          step.cwd
        );
        results.push(result);
        previousOutput = result.output;

        // Stop chain on failure
        if (result.exitCode !== 0) {
          break;
        }
      } catch (error) {
        const errorResult: SingleResult = {
          agent: step.agent,
          agentSource: 'unknown',
          task,
          exitCode: 1,
          output: '',
          duration: 0,
          error: error instanceof Error ? error.message : String(error)
        };
        results.push(errorResult);
        break;
      }
    }

    return {
      mode: 'chain',
      results,
      duration: Date.now() - startTime
    };
  }

  /**
   * Execute in auto mode (decompose, execute, aggregate).
   */
  private async executeAuto(
    execution: AutoExecution,
    startTime: number
  ): Promise<MultiAgentResult> {
    if (!this.decomposer || !this.aggregator) {
      throw new Error('Auto mode requires decomposer and aggregator');
    }

    // Decompose task into subtasks
    const subtasks = await this.decomposer.decompose(execution.task, {});

    // Execute subtasks
    const results: SingleResult[] = [];
    for (const subtask of subtasks) {
      try {
        const result = await this.agentExecutor.execute(
          subtask.assignedTo ?? 'default',
          subtask.description
        );
        results.push(result);
      } catch (error) {
        results.push({
          agent: subtask.assignedTo ?? 'unknown',
          agentSource: 'unknown',
          task: subtask.description,
          exitCode: 1,
          output: '',
          duration: 0,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Aggregate results
    const subtaskResults = results.map((r, i) => ({
      taskId: subtasks[i]?.id ?? `task-${i}`,
      status: r.exitCode === 0 ? 'success' as const : 'failure' as const,
      output: r.output,
      duration: r.duration,
      error: r.error
    }));

    const finalResult = await this.aggregator.aggregate(subtaskResults);

    return {
      mode: 'auto',
      results,
      finalResult,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Create a multi-agent executor.
 */
export function createMultiAgentExecutor(
  agentExecutor: AgentExecutor,
  decomposer?: TaskDecomposer,
  aggregator?: ResultAggregator
): MultiAgentExecutor {
  return new MultiAgentExecutor(agentExecutor, decomposer, aggregator);
}
