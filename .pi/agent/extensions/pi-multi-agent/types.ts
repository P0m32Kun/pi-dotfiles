/**
 * Type definitions for pi-multi-agent.
 *
 * Defines agent roles, execution modes, and result types.
 * Covers all subagent capabilities: single, parallel, chain, and auto modes.
 */

// ── Agent Role Types ───────────────────────────────────────

export interface AgentRole {
  name: string;
  description: string;
  capabilities: string[];
  model?: string;
  tools?: string[];
  systemPrompt?: string;
  source: 'user' | 'project' | 'builtin';
}

export interface AgentConfig {
  roles: AgentRole[];
  maxConcurrent?: number;
  timeout?: number;
}

// ── Execution Mode Types (covering subagent) ───────────────

export type ExecutionMode = 'single' | 'parallel' | 'chain' | 'auto';

export interface SingleExecution {
  mode: 'single';
  agent: string;
  task: string;
  cwd?: string;
}

export interface ParallelExecution {
  mode: 'parallel';
  tasks: Array<{
    agent: string;
    task: string;
    cwd?: string;
  }>;
  maxConcurrency?: number;
}

export interface ChainExecution {
  mode: 'chain';
  steps: Array<{
    agent: string;
    task: string;  // Supports {previous} placeholder
    cwd?: string;
  }>;
}

export interface AutoExecution {
  mode: 'auto';
  task: string;
  decompose?: boolean;
  aggregate?: boolean;
  maxAgents?: number;
}

export type MultiAgentExecution =
  | SingleExecution
  | ParallelExecution
  | ChainExecution
  | AutoExecution;

// ── Task Types ─────────────────────────────────────────────

export type TaskType = 'code' | 'test' | 'review' | 'deploy' | 'other';

export interface SubTask {
  id: string;
  description: string;
  dependencies: string[];
  assignedTo?: string;
  priority: number;
  estimatedDuration?: number;
  type: TaskType;
}

export interface TaskAssignment {
  taskId: string;
  agentRole: string;
  startTime: number;
  endTime: number;
}

export interface Schedule {
  assignments: TaskAssignment[];
  estimatedTotalTime: number;
}

// ── Result Types ───────────────────────────────────────────

export interface SingleResult {
  agent: string;
  agentSource: 'user' | 'project' | 'unknown';
  task: string;
  exitCode: number;
  output: string;
  duration: number;
  model?: string;
  error?: string;
}

export interface SubTaskResult {
  taskId: string;
  status: 'success' | 'failure' | 'skipped';
  output: unknown;
  duration: number;
  error?: string;
}

export interface FinalResult {
  status: 'success' | 'partial' | 'failure';
  output: unknown;
  summary: string;
  details: SubTaskResult[];
}

export interface MultiAgentResult {
  mode: ExecutionMode;
  results: SingleResult[];
  finalResult?: FinalResult;
  duration: number;
}

// ── Decomposition Types ────────────────────────────────────

export interface DecompositionStrategy {
  name: string;
  canHandle(task: string): boolean;
  decompose(task: string, context: Record<string, unknown>): Promise<SubTask[]>;
}

// ── Executor Types ─────────────────────────────────────────

export interface AgentExecutor {
  execute(agent: string, task: string, cwd?: string): Promise<SingleResult>;
}

export interface TaskDecomposer {
  decompose(task: string, context: Record<string, unknown>): Promise<SubTask[]>;
}

export interface ResultAggregator {
  aggregate(results: SubTaskResult[]): Promise<FinalResult>;
}
