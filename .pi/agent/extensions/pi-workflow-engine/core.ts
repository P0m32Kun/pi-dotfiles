/**
 * Core workflow engine for pi-workflow-engine.
 *
 * Provides workflow loading, execution, state machine,
 * parallel execution, and error handling.
 */

import type {
  WorkflowDefinition,
  StepDefinition,
  ExecutionContext,
  StepResult,
  WorkflowResult,
  ToolExecutor,
  StateDefinition,
  WorkflowState,
  Transition
} from './types.js';

export class WorkflowEngine {
  private toolExecutor: ToolExecutor;
  private definition: WorkflowDefinition | null = null;
  private executionContext: ExecutionContext | null = null;
  private currentState: string | null = null;
  private stateHistory: Array<{ state: string; timestamp: number; event?: string }> = [];
  private paused: boolean = false;
  private pauseResolver: (() => void) | null = null;

  constructor(toolExecutor: ToolExecutor) {
    this.toolExecutor = toolExecutor;
  }

  /**
   * Load a workflow definition.
   */
  async load(definition: WorkflowDefinition): Promise<void> {
    // Validate definition
    // Allow empty steps if state machine is defined
    const hasStates = definition.states && definition.states.length > 0;
    if ((!definition.steps || definition.steps.length === 0) && !hasStates) {
      throw new Error('Workflow must have at least one step or state');
    }

    // Check for duplicate step ids
    const stepIds = new Set<string>();
    for (const step of definition.steps) {
      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step id: ${step.id}`);
      }
      stepIds.add(step.id);
    }

    // Validate dependencies
    for (const step of definition.steps) {
      if (step.depends_on) {
        for (const dep of step.depends_on) {
          if (!stepIds.has(dep)) {
            throw new Error(`Step "${step.id}" depends on unknown step "${dep}"`);
          }
        }
      }
    }

    this.definition = definition;
    this.executionContext = {
      workflow: definition,
      completedSteps: [],
      failedSteps: [],
      results: new Map(),
      variables: definition.context ?? {}
    };

    // Initialize state machine if defined
    if (definition.states && definition.states.length > 0) {
      this.currentState = definition.initial_state ?? definition.states[0].name;
      this.stateHistory = [{ state: this.currentState, timestamp: Date.now() }];
    }
  }

  /**
   * Execute the loaded workflow.
   */
  async execute(): Promise<WorkflowResult> {
    if (!this.definition || !this.executionContext) {
      throw new Error('No workflow loaded');
    }

    const startTime = Date.now();
    this.paused = false;

    try {
      // Execute steps in dependency order
      const executionOrder = this.resolveExecutionOrder();
      
      for (const stepId of executionOrder) {
        if (this.paused) {
          return {
            status: 'paused',
            steps: Array.from(this.executionContext.results.values()),
            duration: Date.now() - startTime
          };
        }

        const step = this.definition.steps.find(s => s.id === stepId);
        if (!step) continue;

        await this.executeStep(step);
      }

      return {
        status: this.paused ? 'paused' : 'completed',
        steps: Array.from(this.executionContext.results.values()),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'failed',
        steps: Array.from(this.executionContext.results.values()),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute a single step.
   */
  private async executeStep(step: StepDefinition): Promise<void> {
    if (!this.executionContext) return;

    // Check dependencies
    if (step.depends_on) {
      for (const dep of step.depends_on) {
        if (!this.executionContext.completedSteps.includes(dep)) {
          throw new Error(`Step "${step.id}" dependency "${dep}" not completed`);
        }
      }
    }

    // Check condition
    if (step.condition) {
      const conditionResult = this.evaluateCondition(step.condition);
      if (!conditionResult) {
        this.executionContext.results.set(step.id, {
          stepId: step.id,
          status: 'skipped',
          duration: 0,
          attempts: 0
        });
        return;
      }
    }

    // Execute with retry
    const maxAttempts = step.retry?.max_attempts ?? 1;
    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      try {
        const startTime = Date.now();
        const output = await this.toolExecutor.execute(step.tool, step.args);
        const duration = Date.now() - startTime;

        this.executionContext.results.set(step.id, {
          stepId: step.id,
          status: 'success',
          output,
          duration,
          attempts
        });
        this.executionContext.completedSteps.push(step.id);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxAttempts) {
          // Apply retry delay
          const delay = this.calculateRetryDelay(step.retry, attempt);
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    // All attempts failed
    if (!this.executionContext) return;

    const on_failure = step.on_failure ?? 'stop';
    
    switch (on_failure) {
      case 'stop':
        this.executionContext.results.set(step.id, {
          stepId: step.id,
          status: 'failure',
          error: lastError?.message,
          duration: 0,
          attempts
        });
        this.executionContext.failedSteps.push(step.id);
        throw lastError;

      case 'skip':
        this.executionContext.results.set(step.id, {
          stepId: step.id,
          status: 'skipped',
          error: lastError?.message,
          duration: 0,
          attempts
        });
        break;

      case 'retry':
        // Already retried, treat as stop
        this.executionContext.results.set(step.id, {
          stepId: step.id,
          status: 'failure',
          error: lastError?.message,
          duration: 0,
          attempts
        });
        this.executionContext.failedSteps.push(step.id);
        throw lastError;

      case 'rollback':
        if (step.rollback) {
          await this.toolExecutor.execute(step.rollback.tool, step.rollback.args);
          this.executionContext.results.set(step.id, {
            stepId: step.id,
            status: 'rolled_back',
            error: lastError?.message,
            duration: 0,
            attempts
          });
        }
        break;
    }
  }

  /**
   * Resolve execution order based on dependencies.
   */
  private resolveExecutionOrder(): string[] {
    if (!this.definition) return [];

    const steps = this.definition.steps;
    const visited = new Set<string>();
    const order: string[] = [];

    // Check if step is in a parallel group
    const parallelSteps = new Set<string>();
    if (this.definition.parallel) {
      for (const group of this.definition.parallel) {
        for (const stepId of group.steps) {
          parallelSteps.add(stepId);
        }
      }
    }

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step?.depends_on) {
        for (const dep of step.depends_on) {
          visit(dep);
        }
      }

      order.push(stepId);
    };

    // Visit all steps
    for (const step of steps) {
      visit(step.id);
    }

    return order;
  }

  /**
   * Evaluate a condition expression.
   */
  private evaluateCondition(condition: string): boolean {
    if (!this.executionContext) return false;

    // Handle simple boolean strings
    if (condition === 'true') return true;
    if (condition === 'false') return false;

    // Handle variable references
    const variables = this.executionContext.variables;
    if (condition in variables) {
      return !!variables[condition];
    }

    // Handle comparison expressions
    const comparisonMatch = condition.match(/^(\w+)\s*(>|<|>=|<=|==|!=)\s*(.+)$/);
    if (comparisonMatch) {
      const [, varName, operator, valueStr] = comparisonMatch;
      const varValue = variables[varName];
      let compareValue: unknown = valueStr;

      // Parse numeric values
      if (/^\d+$/.test(valueStr)) {
        compareValue = parseInt(valueStr, 10);
      } else if (/^\d+\.\d+$/.test(valueStr)) {
        compareValue = parseFloat(valueStr);
      } else if (valueStr === 'true') {
        compareValue = true;
      } else if (valueStr === 'false') {
        compareValue = false;
      }

      switch (operator) {
        case '>': return (varValue as number) > (compareValue as number);
        case '<': return (varValue as number) < (compareValue as number);
        case '>=': return (varValue as number) >= (compareValue as number);
        case '<=': return (varValue as number) <= (compareValue as number);
        case '==': return varValue == compareValue;
        case '!=': return varValue != compareValue;
      }
    }

    // Default: treat non-empty string as truthy
    return condition.trim().length > 0;
  }

  /**
   * Calculate retry delay based on strategy.
   */
  private calculateRetryDelay(retryConfig: StepDefinition['retry'], attempt: number): number {
    if (!retryConfig) return 0;

    const strategy = retryConfig.strategy ?? 'immediate';
    const baseDelay = retryConfig.base_delay_ms ?? 1000;
    const maxDelay = retryConfig.max_delay_ms ?? 30000;

    switch (strategy) {
      case 'immediate':
        return 0;
      case 'backoff':
        return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      case 'adaptive':
        return Math.min(baseDelay * attempt, maxDelay);
      default:
        return 0;
    }
  }

  /**
   * Get current workflow status.
   */
  getStatus(): { loaded: boolean; name?: string; currentState?: string } {
    return {
      loaded: !!this.definition,
      name: this.definition?.name,
      currentState: this.currentState ?? undefined
    };
  }

  /**
   * Get current state (for state machine workflows).
   */
  getCurrentState(): string | null {
    return this.currentState;
  }

  /**
   * Trigger a state machine event.
   */
  async triggerEvent(event: string): Promise<void> {
    if (!this.definition?.states || !this.currentState) {
      throw new Error('No state machine defined');
    }

    const currentStateDef = this.definition.states.find(s => s.name === this.currentState);
    if (!currentStateDef) {
      throw new Error(`Unknown state: ${this.currentState}`);
    }

    const transition = currentStateDef.transitions.find(t => t.event === event);
    if (!transition) {
      throw new Error(`No transition for event "${event}" in state "${this.currentState}"`);
    }

    // Check condition if specified
    if (transition.condition && !this.evaluateCondition(transition.condition)) {
      throw new Error(`Transition condition not met for event "${event}"`);
    }

    // Execute on_exit steps if defined
    if (currentStateDef.on_exit) {
      for (const step of currentStateDef.on_exit) {
        await this.executeStep(step);
      }
    }

    // Transition to new state
    const previousState = this.currentState;
    this.currentState = transition.to;
    this.stateHistory.push({ state: this.currentState, timestamp: Date.now(), event });

    // Execute on_enter steps if defined
    const newStateDef = this.definition.states.find(s => s.name === this.currentState);
    if (newStateDef?.on_enter) {
      for (const step of newStateDef.on_enter) {
        await this.executeStep(step);
      }
    }
  }

  /**
   * Pause workflow execution.
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume workflow execution.
   */
  async resume(): Promise<WorkflowResult> {
    if (!this.paused) {
      throw new Error('Workflow is not paused');
    }

    this.paused = false;
    return this.execute();
  }

  /**
   * Get state history.
   */
  getStateHistory(): Array<{ state: string; timestamp: number; event?: string }> {
    return [...this.stateHistory];
  }
}
