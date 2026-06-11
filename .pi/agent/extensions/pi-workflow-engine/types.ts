/**
 * Type definitions for pi-workflow-engine.
 *
 * Defines workflow definition format, steps, conditions,
 * parallel groups, and state machine types.
 */

// ── Step Types ──────────────────────────────────────────────

export interface StepDefinition {
  id: string;
  name: string;
  tool: string;
  args: Record<string, unknown>;
  depends_on?: string[];
  condition?: string;
  on_failure?: 'stop' | 'retry' | 'skip' | 'rollback';
  retry?: RetryConfig;
  rollback?: RollbackConfig;
  timeout?: number;
}

export interface RetryConfig {
  max_attempts: number;
  strategy?: 'immediate' | 'backoff' | 'adaptive';
  base_delay_ms?: number;
  max_delay_ms?: number;
}

export interface RollbackConfig {
  tool: string;
  args: Record<string, unknown>;
}

// ── Parallel Group ──────────────────────────────────────────

export interface ParallelGroup {
  group: string;
  steps: string[];
  max_concurrency?: number;
}

// ── State Machine ───────────────────────────────────────────

export interface StateDefinition {
  name: string;
  transitions: Transition[];
  on_enter?: StepDefinition[];
  on_exit?: StepDefinition[];
}

export interface Transition {
  to: string;
  event: string;
  condition?: string;
}

// ── Workflow Definition ─────────────────────────────────────

export interface WorkflowDefinition {
  name: string;
  version: string;
  description?: string;
  steps: StepDefinition[];
  parallel?: ParallelGroup[];
  states?: StateDefinition[];
  initial_state?: string;
  context?: Record<string, unknown>;
}

// ── Execution Types ─────────────────────────────────────────

export interface ExecutionContext {
  workflow: WorkflowDefinition;
  currentState?: string;
  completedSteps: string[];
  failedSteps: string[];
  results: Map<string, StepResult>;
  variables: Record<string, unknown>;
}

export interface StepResult {
  stepId: string;
  status: 'success' | 'failure' | 'skipped' | 'rolled_back';
  output?: unknown;
  error?: string;
  duration: number;
  attempts: number;
}

export interface WorkflowResult {
  status: 'completed' | 'failed' | 'paused' | 'cancelled';
  steps: StepResult[];
  duration: number;
  error?: string;
}

// ── State Machine Types ─────────────────────────────────────

export interface WorkflowState {
  name: string;
  history: Array<{ state: string; timestamp: number; event?: string }>;
  context: Record<string, unknown>;
}

export interface StateMachineConfig {
  states: StateDefinition[];
  initialState: string;
  context?: Record<string, unknown>;
}

// ── Tool Types ──────────────────────────────────────────────

export interface ToolExecutor {
  execute(tool: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface WorkflowLoadParams {
  definition?: WorkflowDefinition;
  path?: string;
  format?: 'json' | 'yaml';
}

export interface WorkflowExecuteParams {
  workflow: string;
  context?: Record<string, unknown>;
  dry_run?: boolean;
}

export interface WorkflowStatusParams {
  workflow?: string;
}

export interface WorkflowPauseParams {
  workflow: string;
}

export interface WorkflowResumeParams {
  workflow: string;
  context?: Record<string, unknown>;
}
