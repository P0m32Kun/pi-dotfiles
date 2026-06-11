/**
 * Task decomposer for pi-multi-agent.
 *
 * Provides strategies for decomposing complex tasks into subtasks.
 */

import type { SubTask, TaskType, DecompositionStrategy } from './types.js';

export class TaskDecomposerImpl {
  private strategies: DecompositionStrategy[];

  constructor(strategies: DecompositionStrategy[]) {
    this.strategies = strategies;
  }

  /**
   * Decompose a task using the first matching strategy.
   */
  async decompose(task: string, context: Record<string, unknown>): Promise<SubTask[]> {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(task)) {
        return strategy.decompose(task, context);
      }
    }

    // Default: return single task
    return [{
      id: 'task-1',
      description: task,
      dependencies: [],
      priority: 1,
      type: 'other'
    }];
  }
}

/**
 * Code module strategy - decomposes code implementation tasks.
 */
export class CodeModuleStrategy implements DecompositionStrategy {
  name = 'code-module';

  canHandle(task: string): boolean {
    const keywords = ['implement', 'create', 'build', 'develop', 'add', 'write'];
    const lowerTask = task.toLowerCase();
    return keywords.some(k => lowerTask.includes(k)) &&
           (lowerTask.includes('module') || lowerTask.includes('service') ||
            lowerTask.includes('endpoint') || lowerTask.includes('api') ||
            lowerTask.includes('function') || lowerTask.includes('class'));
  }

  async decompose(task: string, context: Record<string, unknown>): Promise<SubTask[]> {
    const id = this.generateId(task);
    
    return [
      {
        id: `${id}-design`,
        description: `Design the solution for: ${task}`,
        dependencies: [],
        priority: 1,
        type: 'code'
      },
      {
        id: `${id}-implement`,
        description: `Implement: ${task}`,
        dependencies: [`${id}-design`],
        priority: 2,
        type: 'code'
      },
      {
        id: `${id}-test`,
        description: `Write tests for: ${task}`,
        dependencies: [`${id}-implement`],
        priority: 3,
        type: 'test'
      },
      {
        id: `${id}-review`,
        description: `Review: ${task}`,
        dependencies: [`${id}-implement`, `${id}-test`],
        priority: 4,
        type: 'review'
      }
    ];
  }

  private generateId(task: string): string {
    return task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20);
  }
}

/**
 * Feature strategy - decomposes feature implementation tasks.
 */
export class FeatureStrategy implements DecompositionStrategy {
  name = 'feature';

  canHandle(task: string): boolean {
    const keywords = ['feature', 'functionality', 'capability', 'enhancement'];
    const lowerTask = task.toLowerCase();
    return keywords.some(k => lowerTask.includes(k));
  }

  async decompose(task: string, context: Record<string, unknown>): Promise<SubTask[]> {
    const id = this.generateId(task);
    
    return [
      {
        id: `${id}-requirements`,
        description: `Define requirements for: ${task}`,
        dependencies: [],
        priority: 1,
        type: 'other'
      },
      {
        id: `${id}-design`,
        description: `Design architecture for: ${task}`,
        dependencies: [`${id}-requirements`],
        priority: 2,
        type: 'code'
      },
      {
        id: `${id}-implement`,
        description: `Implement: ${task}`,
        dependencies: [`${id}-design`],
        priority: 3,
        type: 'code'
      },
      {
        id: `${id}-test`,
        description: `Test: ${task}`,
        dependencies: [`${id}-implement`],
        priority: 4,
        type: 'test'
      }
    ];
  }

  private generateId(task: string): string {
    return task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20);
  }
}

/**
 * Test strategy - decomposes test writing tasks.
 */
export class TestStrategy implements DecompositionStrategy {
  name = 'test';

  canHandle(task: string): boolean {
    const keywords = ['test', 'tests', 'testing', 'spec', 'specs'];
    const lowerTask = task.toLowerCase();
    return keywords.some(k => lowerTask.includes(k));
  }

  async decompose(task: string, context: Record<string, unknown>): Promise<SubTask[]> {
    const id = this.generateId(task);
    
    return [
      {
        id: `${id}-plan`,
        description: `Plan test cases for: ${task}`,
        dependencies: [],
        priority: 1,
        type: 'test'
      },
      {
        id: `${id}-unit`,
        description: `Write unit tests for: ${task}`,
        dependencies: [`${id}-plan`],
        priority: 2,
        type: 'test'
      },
      {
        id: `${id}-integration`,
        description: `Write integration tests for: ${task}`,
        dependencies: [`${id}-unit`],
        priority: 3,
        type: 'test'
      }
    ];
  }

  private generateId(task: string): string {
    return task
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20);
  }
}

/**
 * Create a task decomposer with default strategies.
 */
export function createTaskDecomposer(): TaskDecomposerImpl {
  return new TaskDecomposerImpl([
    new CodeModuleStrategy(),
    new FeatureStrategy(),
    new TestStrategy()
  ]);
}
