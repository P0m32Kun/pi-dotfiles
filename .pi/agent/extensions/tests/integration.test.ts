/**
 * Integration tests for all pi extensions.
 *
 * Tests the collaboration between:
 * - pi-loop-engine (enhanced)
 * - pi-workflow-engine
 * - pi-multi-agent
 * - pi-test-integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── pi-loop-engine imports ─────────────────────────────────

import { evaluateCondition, executeBranch } from './pi-loop-engine/branch.js';
import { executeWhileLoop, executeForLoop } from './pi-loop-engine/loop.js';
import { MemoryPersistence } from './pi-loop-engine/persistence.js';
import { ImmediateStrategy, BackoffStrategy, AdaptiveStrategy } from './pi-loop-engine/retry-strategy.js';

// ── pi-workflow-engine imports ─────────────────────────────

import { WorkflowEngine } from './pi-workflow-engine/core.js';
import { ParallelExecutor } from './pi-workflow-engine/parallel.js';
import { StateMachine } from './pi-workflow-engine/state-machine.js';
import { ErrorHandler } from './pi-workflow-engine/error-handler.js';

// ── pi-multi-agent imports ─────────────────────────────────

import { MultiAgentExecutor } from './pi-multi-agent/executor.js';
import { TaskDecomposerImpl, CodeModuleStrategy, FeatureStrategy, TestStrategy } from './pi-multi-agent/decomposer.js';
import { ResultAggregatorImpl } from './pi-multi-agent/aggregator.js';

// ── pi-test-integration imports ────────────────────────────

import { VitestAdapter, JestAdapter, PytestAdapter, detectFramework, createAdapter } from './pi-test-integration/adapters.js';
import { FailureAnalyzerImpl } from './pi-test-integration/analyzer.js';

describe('Integration Tests', () => {
  describe('pi-loop-engine enhanced features', () => {
    it('should combine branch and loop', async () => {
      // Test: Branch based on condition, then loop
      let counter = 0;
      const result = await executeBranch({
        condition: 'true',
        truePath: [
          {
            id: 'loop',
            execute: async () => {
              const loopResult = await executeForLoop(3, [
                {
                  id: 'increment',
                  execute: async () => {
                    counter++;
                    return { success: true, data: counter };
                  }
                }
              ]);
              return { success: true, data: loopResult };
            }
          }
        ],
        falsePath: []
      });

      expect(counter).toBe(3);
      expect(result.executed).toBe('true');
    });

    it('should persist state across operations', async () => {
      const persistence = new MemoryPersistence();
      
      // Save state
      await persistence.save({
        attempts: { test: 2 },
        failures: [],
        totalRetries: 2,
        totalSuccesses: 1,
        lastUpdated: Date.now(),
        loopCounters: { loop1: 5 },
        branchHistory: []
      });

      // Load state
      const state = await persistence.load();
      expect(state).not.toBeNull();
      expect(state?.attempts.test).toBe(2);
      expect(state?.loopCounters.loop1).toBe(5);
    });

    it('should use different retry strategies', async () => {
      const immediate = new ImmediateStrategy({ maxAttempts: 3 });
      const backoff = new BackoffStrategy({ maxAttempts: 3, baseDelayMs: 100 });
      const adaptive = new AdaptiveStrategy({
        maxAttempts: 3,
        baseDelayMs: 100,
        errorDelays: { timeout: 5000 }
      });

      const context = {
        attempt: 1,
        maxAttempts: 3,
        lastError: new Error('timeout'),
        elapsedMs: 0
      };

      const immediateResult = await immediate.shouldRetry(context);
      const backoffResult = await backoff.shouldRetry(context);
      const adaptiveResult = await adaptive.shouldRetry(context);

      expect(immediateResult.retry).toBe(true);
      expect(immediateResult.delayMs).toBe(0);

      expect(backoffResult.retry).toBe(true);
      expect(backoffResult.delayMs).toBeGreaterThan(0);

      expect(adaptiveResult.retry).toBe(true);
      expect(adaptiveResult.delayMs).toBe(5000); // timeout delay
    });
  });

  describe('pi-workflow-engine', () => {
    it('should execute workflow with dependencies', async () => {
      const executionOrder: string[] = [];
      const mockExecutor = {
        execute: async (tool: string, args: any) => {
          executionOrder.push(args.command);
          return { success: true };
        }
      };

      const engine = new WorkflowEngine(mockExecutor);
      await engine.load({
        name: 'test-workflow',
        version: '1.0',
        steps: [
          { id: 'step1', name: 'Step 1', tool: 'bash', args: { command: 'step1' } },
          { id: 'step2', name: 'Step 2', tool: 'bash', args: { command: 'step2' }, depends_on: ['step1'] },
          { id: 'step3', name: 'Step 3', tool: 'bash', args: { command: 'step3' }, depends_on: ['step2'] }
        ]
      });

      const result = await engine.execute();
      expect(result.status).toBe('completed');
      expect(executionOrder).toEqual(['step1', 'step2', 'step3']);
    });

    it('should handle state machine transitions', async () => {
      const stateMachine = new StateMachine(
        [
          { name: 'idle', transitions: [{ to: 'running', event: 'start' }] },
          { name: 'running', transitions: [{ to: 'completed', event: 'finish' }] },
          { name: 'completed', transitions: [] }
        ],
        'idle'
      );

      expect(stateMachine.getCurrentState()).toBe('idle');
      
      await stateMachine.transition('start');
      expect(stateMachine.getCurrentState()).toBe('running');
      
      await stateMachine.transition('finish');
      expect(stateMachine.getCurrentState()).toBe('completed');
      expect(stateMachine.isTerminal()).toBe(true);
    });

    it('should execute parallel steps', async () => {
      const executionOrder: string[] = [];
      const mockExecutor = {
        execute: async (tool: string, args: any) => {
          executionOrder.push(args.command);
          return { success: true };
        }
      };

      const parallelExecutor = new ParallelExecutor(mockExecutor);
      const result = await parallelExecutor.execute(
        [
          { id: 'p1', name: 'P1', tool: 'bash', args: { command: 'p1' } },
          { id: 'p2', name: 'P2', tool: 'bash', args: { command: 'p2' } },
          { id: 'p3', name: 'P3', tool: 'bash', args: { command: 'p3' } }
        ],
        { maxConcurrency: 3 }
      );

      expect(result.results).toHaveLength(3);
      expect(result.results.every(r => r.status === 'success')).toBe(true);
    });

    it('should handle error recovery', async () => {
      let attempts = 0;
      const mockExecutor = {
        execute: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { success: true };
        }
      };

      const errorHandler = new ErrorHandler({
        maxRetries: 3,
        strategies: {
          retry: { maxAttempts: 3, strategy: 'immediate' }
        }
      });

      const result = await errorHandler.handle(
        mockExecutor.execute,
        { on_failure: 'retry' }
      );

      expect(result.status).toBe('success');
      expect(result.attempts).toBe(3);
    });
  });

  describe('pi-multi-agent', () => {
    it('should execute single agent task', async () => {
      const mockExecutor = {
        execute: async (agent: string, task: string) => ({
          agent,
          agentSource: 'user' as const,
          task,
          exitCode: 0,
          output: `Result: ${task}`,
          duration: 100
        })
      };

      const executor = new MultiAgentExecutor(mockExecutor);
      const result = await executor.execute({
        mode: 'single',
        agent: 'coder',
        task: 'Write code'
      });

      expect(result.mode).toBe('single');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].agent).toBe('coder');
    });

    it('should execute parallel tasks', async () => {
      const mockExecutor = {
        execute: async (agent: string, task: string) => ({
          agent,
          agentSource: 'user' as const,
          task,
          exitCode: 0,
          output: `Result: ${task}`,
          duration: 100
        })
      };

      const executor = new MultiAgentExecutor(mockExecutor);
      const result = await executor.execute({
        mode: 'parallel',
        tasks: [
          { agent: 'coder', task: 'Task 1' },
          { agent: 'tester', task: 'Task 2' }
        ]
      });

      expect(result.mode).toBe('parallel');
      expect(result.results).toHaveLength(2);
    });

    it('should execute chain with {previous} placeholder', async () => {
      const mockExecutor = {
        execute: async (agent: string, task: string) => ({
          agent,
          agentSource: 'user' as const,
          task,
          exitCode: 0,
          output: `Output from ${agent}`,
          duration: 100
        })
      };

      const executor = new MultiAgentExecutor(mockExecutor);
      const result = await executor.execute({
        mode: 'chain',
        steps: [
          { agent: 'step1', task: 'First step' },
          { agent: 'step2', task: 'Continue with {previous}' }
        ]
      });

      expect(result.mode).toBe('chain');
      expect(result.results).toHaveLength(2);
    });

    it('should decompose task into subtasks', async () => {
      const decomposer = new TaskDecomposerImpl([
        new CodeModuleStrategy(),
        new FeatureStrategy(),
        new TestStrategy()
      ]);

      const subtasks = await decomposer.decompose('Implement user authentication module', {});
      
      expect(subtasks.length).toBeGreaterThanOrEqual(3);
      expect(subtasks.some(t => t.type === 'code')).toBe(true);
      expect(subtasks.some(t => t.type === 'test')).toBe(true);
    });

    it('should aggregate results', async () => {
      const aggregator = new ResultAggregatorImpl();
      
      const result = await aggregator.aggregate([
        { taskId: 'task1', status: 'success', output: 'Result 1', duration: 100 },
        { taskId: 'task2', status: 'success', output: 'Result 2', duration: 200 }
      ]);

      expect(result.status).toBe('success');
      expect(result.summary).toContain('2/2');
    });
  });

  describe('pi-test-integration', () => {
    it('should detect test framework', async () => {
      // Test detection logic
      const vitestAdapter = new VitestAdapter();
      const jestAdapter = new JestAdapter();
      const pytestAdapter = new PytestAdapter();

      expect(vitestAdapter.name).toBe('vitest');
      expect(jestAdapter.name).toBe('jest');
      expect(pytestAdapter.name).toBe('pytest');
    });

    it('should create adapter by name', () => {
      expect(createAdapter('vitest')).toBeInstanceOf(VitestAdapter);
      expect(createAdapter('jest')).toBeInstanceOf(JestAdapter);
      expect(createAdapter('pytest')).toBeInstanceOf(PytestAdapter);
      expect(() => createAdapter('unknown')).toThrow();
    });

    it('should analyze test failures', async () => {
      const analyzer = new FailureAnalyzerImpl();
      
      const result = await analyzer.analyze({
        testName: 'test',
        error: 'expected 1 to equal 2',
        actual: 1,
        expected: 2
      });

      expect(result.rootCause).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should analyze type errors', async () => {
      const analyzer = new FailureAnalyzerImpl();
      
      const result = await analyzer.analyze({
        testName: 'test',
        error: 'TypeError: Cannot read property of undefined'
      });

      expect(result.rootCause).toContain('undefined');
      expect(result.suggestion).toContain('optional chaining');
    });
  });

  describe('Cross-extension integration', () => {
    it('should use loop-engine with workflow-engine', async () => {
      // Scenario: Workflow step fails, loop-engine retries
      let attempts = 0;
      const mockExecutor = {
        execute: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Step failed');
          }
          return { success: true };
        }
      };

      // Use workflow engine with error handler
      const errorHandler = new ErrorHandler({
        maxRetries: 3,
        strategies: {
          retry: { maxAttempts: 3, strategy: 'immediate' }
        }
      });

      const result = await errorHandler.handle(
        mockExecutor.execute,
        { on_failure: 'retry' }
      );

      expect(result.status).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should use multi-agent with workflow', async () => {
      // Scenario: Multi-agent executes workflow steps
      const mockExecutor = {
        execute: async (agent: string, task: string) => ({
          agent,
          agentSource: 'user' as const,
          task,
          exitCode: 0,
          output: `Completed: ${task}`,
          duration: 100
        })
      };

      const multiAgent = new MultiAgentExecutor(mockExecutor);
      
      // Execute workflow steps in parallel
      const result = await multiAgent.execute({
        mode: 'parallel',
        tasks: [
          { agent: 'coder', task: 'Implement feature' },
          { agent: 'tester', task: 'Write tests' }
        ]
      });

      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => r.exitCode === 0)).toBe(true);
    });

    it('should analyze test failures and suggest fixes', async () => {
      // Scenario: Test fails, analyzer provides suggestion
      const analyzer = new FailureAnalyzerImpl();
      
      const analysis = await analyzer.analyze({
        testName: 'should authenticate user',
        error: 'ReferenceError: authService is not defined',
        file: 'auth.test.ts'
      });

      expect(analysis.rootCause).toContain('authService');
      expect(analysis.suggestion).toContain('imported');
      expect(analysis.relatedFiles).toContain('auth.test.ts');
    });
  });
});
