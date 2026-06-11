/**
 * Loop support for pi-loop-engine.
 *
 * Provides while and for loop execution with support for
 * break conditions and iteration tracking.
 */

import { evaluateCondition } from './branch.js';

export interface Step {
  id: string;
  execute: (iteration?: number) => Promise<StepResult>;
}

export interface StepResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface LoopConfig {
  condition: string | (() => boolean);
  body: Step[];
  maxIterations: number;
  breakCondition?: string | (() => boolean);
  context?: Record<string, unknown>;
}

export interface LoopResult {
  iterations: number;
  results: StepResult[];
  stoppedReason?: 'condition' | 'maxIterations' | 'breakCondition';
  duration: number;
}

/**
 * Execute a while loop.
 *
 * Continues executing the body steps while the condition is true.
 * Stops when:
 * - Condition becomes false
 * - maxIterations is reached
 * - breakCondition is met
 */
export async function executeWhileLoop(config: LoopConfig): Promise<LoopResult> {
  const startTime = Date.now();
  const results: StepResult[] = [];
  let iterations = 0;
  let stoppedReason: LoopResult['stoppedReason'];

  while (iterations < config.maxIterations) {
    // Check break condition first
    if (config.breakCondition) {
      const shouldBreak = evaluateCondition(config.breakCondition, config.context);
      if (shouldBreak) {
        stoppedReason = 'breakCondition';
        break;
      }
    }

    // Check main condition
    const shouldContinue = evaluateCondition(config.condition, config.context);
    if (!shouldContinue) {
      stoppedReason = 'condition';
      break;
    }

    // Execute body steps
    for (const step of config.body) {
      const result = await step.execute(iterations);
      results.push(result);
    }

    iterations++;
  }

  // Check if we stopped due to maxIterations
  if (iterations >= config.maxIterations && !stoppedReason) {
    stoppedReason = 'maxIterations';
  }

  return {
    iterations,
    results,
    stoppedReason,
    duration: Date.now() - startTime,
  };
}

/**
 * Execute a for loop.
 *
 * Executes the body steps a specified number of times.
 * Each step receives the current iteration index (0-based).
 */
export async function executeForLoop(
  count: number,
  body: Step[]
): Promise<LoopResult> {
  const startTime = Date.now();
  const results: StepResult[] = [];

  for (let iteration = 0; iteration < count; iteration++) {
    for (const step of body) {
      const result = await step.execute(iteration);
      results.push(result);
    }
  }

  return {
    iterations: count,
    results,
    duration: Date.now() - startTime,
  };
}

/**
 * Create a loop configuration from simplified parameters.
 */
export function createLoop(config: {
  type: 'while' | 'for';
  condition?: string | (() => boolean);
  count?: number;
  body: Array<{ id: string; execute: (iteration?: number) => Promise<StepResult> }>;
  maxIterations?: number;
  breakCondition?: string | (() => boolean);
  context?: Record<string, unknown>;
}): LoopConfig | { type: 'for'; count: number; body: Step[] } {
  if (config.type === 'while') {
    return {
      condition: config.condition ?? (() => true),
      body: config.body,
      maxIterations: config.maxIterations ?? 100,
      breakCondition: config.breakCondition,
      context: config.context,
    };
  }

  return {
    type: 'for',
    count: config.count ?? 0,
    body: config.body,
  };
}
